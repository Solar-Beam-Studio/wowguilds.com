import { Worker, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, sendAlert } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { ExternalApiService } from "../services/external-api.service";
import type { EventPublisher } from "../services/event-publisher.service";

interface CharacterSyncJobData {
  guildId: string;
  characters: Array<{
    characterName: string;
    realm: string;
    characterApiUrl: string | null;
    characterClass: string | null;
  }>;
  syncJobId: string;
  batchIndex: number;
  totalBatches: number;
}

export function createCharacterSyncWorker(
  connection: ConnectionOptions,
  externalApi: ExternalApiService,
  eventPublisher: EventPublisher
) {
  return new Worker<CharacterSyncJobData>(
    QUEUE_NAMES.CHARACTER_SYNC,
    async (job: Job<CharacterSyncJobData>) => {
      const { guildId, characters, syncJobId, batchIndex, totalBatches } =
        job.data;

      if (!guildId || !Array.isArray(characters) || !syncJobId) {
        throw new Error("Invalid job data: missing required fields");
      }

      console.log(
        `[CharSync] Batch ${batchIndex + 1}/${totalBatches} for guild ${guildId}: ${characters.length} characters`
      );

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return;

      let syncedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        let hadError = false;

        try {
          const data = await externalApi.getMember(
            char.characterName,
            char.realm,
            guild.region,
            "auto",
            char.characterApiUrl
          );

          await prisma.guildMember.update({
            where: {
              guildId_characterName_realm: {
                guildId,
                characterName: char.characterName,
                realm: char.realm,
              },
            },
            data: {
              characterClass: data.characterClass || char.characterClass,
              itemLevel: data.itemLevel,
              mythicPlusScore: data.mythicPlusScore,
              currentSeason: data.currentSeason,
              pvp2v2Rating: data.pvp2v2Rating,
              pvp3v3Rating: data.pvp3v3Rating,
              pvpRbgRating: data.pvpRbgRating,
              soloShuffleRating: data.soloShuffleRating,
              maxSoloShuffleRating: data.maxSoloShuffleRating,
              rbgShuffleRating: data.rbgShuffleRating,
              achievementPoints: data.achievementPoints,
              raidProgress: data.raidProgress,
              weeklyKeysCompleted: data.weeklyKeysCompleted,
              weeklyBestKeyLevel: data.weeklyBestKeyLevel,
              weeklySlot2KeyLevel: data.weeklySlot2KeyLevel,
              weeklySlot3KeyLevel: data.weeklySlot3KeyLevel,
              lastHourlyCheck: new Date(),
              lastUpdated: new Date(),
            },
          });

          syncedCount++;
        } catch (error) {
          hadError = true;
          errorCount++;
          const rawMsg = error instanceof Error ? error.message : String(error);
          const errorMsg = rawMsg.replace(/Bearer\s+\S+/g, "Bearer [REDACTED]").slice(0, 500);

          await prisma.syncError.create({
            data: {
              guildId,
              characterName: char.characterName,
              realm: char.realm,
              errorType: "sync_error",
              errorMessage: errorMsg,
              service: "auto",
            },
          });
        }

        // Update sync job progress
        await prisma.syncJob.update({
          where: { id: syncJobId },
          data: {
            processedItems: { increment: 1 },
            errorCount: { increment: hadError ? 1 : 0 },
            currentCharacter: char.characterName,
          },
        });

        // Publish progress every 10 characters (reduces Redis noise)
        if ((i + 1) % 10 === 0 || i === characters.length - 1) {
          await eventPublisher.publishProgress(
            guildId,
            i + 1,
            characters.length,
            errorCount,
            char.characterName
          );
        }

        // Rate limit: 1s between characters
        if (i < characters.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      console.log(
        `[CharSync] Batch ${batchIndex + 1} done: ${syncedCount} synced, ${errorCount} errors`
      );

      // Alert if >50% of batch failed
      if (characters.length > 0 && errorCount / characters.length > 0.5) {
        await sendAlert({
          title: "High Sync Error Rate",
          message: `Guild ${guild.name}: batch ${batchIndex + 1}/${totalBatches} — ${errorCount}/${characters.length} failed (${Math.round((errorCount / characters.length) * 100)}%)`,
          level: "warning",
          source: "worker/character-sync",
          emoji: "⚠️",
        });
      }

      // Check if all batches are done → mark SyncJob completed + publish event
      const syncJobState = await prisma.syncJob.findUnique({
        where: { id: syncJobId },
        select: { processedItems: true, totalItems: true, startedAt: true, errorCount: true },
      });

      if (syncJobState && syncJobState.processedItems >= syncJobState.totalItems) {
        const duration = Math.round(
          (Date.now() - (syncJobState.startedAt?.getTime() ?? Date.now())) / 1000
        );

        // Atomically mark completed (only one batch wins the race)
        const updated = await prisma.syncJob.updateMany({
          where: { id: syncJobId, status: "running" },
          data: { status: "completed", completedAt: new Date(), duration },
        });

        if (updated.count > 0) {
          await eventPublisher.publishComplete(
            guildId,
            syncJobState.processedItems,
            syncJobState.errorCount,
            duration,
            "active_sync"
          );
          console.log(
            `[CharSync] All batches complete for guild ${guild.name}: ${syncJobState.processedItems} characters (${duration}s)`
          );
        }
      }

      return { syncedCount, errorCount };
    },
    { connection, concurrency: 2 }
  );
}
