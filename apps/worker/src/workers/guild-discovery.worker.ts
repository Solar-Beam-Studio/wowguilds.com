import { Worker, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, sendAlert } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { ExternalApiService } from "../services/external-api.service";
import type { EventPublisher } from "../services/event-publisher.service";

interface DiscoveryJobData {
  guildId: string;
}

export function createGuildDiscoveryWorker(
  connection: ConnectionOptions,
  externalApi: ExternalApiService,
  eventPublisher: EventPublisher
) {
  return new Worker<DiscoveryJobData>(
    QUEUE_NAMES.GUILD_DISCOVERY,
    async (job: Job<DiscoveryJobData>) => {
      const { guildId } = job.data;

      if (!guildId || typeof guildId !== "string") {
        throw new Error("Invalid job data: missing guildId");
      }

      const startTime = Date.now();

      console.log(`[Discovery] Starting for guild ${guildId}`);

      // Get guild config
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild || !guild.syncEnabled) {
        console.log(`[Discovery] Guild ${guildId} not found or sync disabled`);
        return;
      }

      // Create sync job record
      const syncJob = await prisma.syncJob.create({
        data: {
          guildId,
          type: "discovery",
          status: "running",
          bullmqJobId: job.id,
          startedAt: new Date(),
        },
      });

      try {
        // Step 1: Fetch roster from Blizzard
        const members = await externalApi.getMembers(
          guild.name,
          guild.realm,
          guild.region
        );

        if (!members.length) {
          console.log(`[Discovery] No members found for ${guild.name}`);
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: { status: "completed", completedAt: new Date(), duration: Math.round((Date.now() - startTime) / 1000) },
          });
          return;
        }

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: { totalItems: members.length },
        });

        // Step 2: Upsert members
        let upsertErrors = 0;
        for (const member of members) {
          try {
            await prisma.guildMember.upsert({
              where: {
                guildId_characterName_realm: {
                  guildId,
                  characterName: member.name,
                  realm: member.realm,
                },
              },
              update: {
                characterClass: member.characterClass,
                level: member.level,
                characterApiUrl: member.characterApiUrl,
                lastUpdated: new Date(),
              },
              create: {
                guildId,
                characterName: member.name,
                realm: member.realm,
                characterClass: member.characterClass,
                level: member.level,
                characterApiUrl: member.characterApiUrl,
              },
            });
          } catch (error) {
            upsertErrors++;
            console.error(
              `[Discovery] Failed to upsert ${member.name}: ${error}`
            );
          }
        }

        // Step 3: Bulk check activity
        const activityResults = await externalApi.bulkCheckActivity(
          members,
          guild.region
        );

        let updateSuccess = 0;
        let updateErrors = 0;
        for (const result of activityResults) {
          try {
            const updateData: Record<string, unknown> = {
              lastActivityCheck: new Date(),
            };
            if (result.activityData.lastLoginTimestamp) {
              updateData.lastLoginTimestamp = BigInt(
                result.activityData.lastLoginTimestamp
              );
              updateData.activityStatus = result.activityData.activityStatus;
            } else {
              updateData.activityStatus = "inactive";
            }

            await prisma.guildMember.update({
              where: {
                guildId_characterName_realm: {
                  guildId,
                  characterName: result.characterName,
                  realm: result.realm,
                },
              },
              data: updateData,
            });
            updateSuccess++;
          } catch {
            updateErrors++;
          }
        }

        // Step 4: Remove departed members
        const currentNames = new Set(members.map((m) => m.name));
        const existingMembers = await prisma.guildMember.findMany({
          where: { guildId },
          select: { characterName: true },
        });

        const departed = existingMembers
          .filter((m) => !currentNames.has(m.characterName))
          .map((m) => m.characterName);

        if (departed.length > 0) {
          await prisma.guildMember.deleteMany({
            where: {
              guildId,
              characterName: { in: departed },
            },
          });
          console.log(
            `[Discovery] Removed ${departed.length} departed members`
          );
        }

        // Step 5: Fetch guild crest
        const crest = await externalApi.getGuildCrest(guild.name, guild.realm, guild.region);

        // Update guild stats + crest
        const duration = Math.round((Date.now() - startTime) / 1000);
        await prisma.guild.update({
          where: { id: guildId },
          data: {
            lastDiscoveryAt: new Date(),
            memberCount: members.length,
            crestEmblemId: crest.emblemId,
            crestEmblemColor: crest.emblemColor,
            crestBorderId: crest.borderId,
            crestBorderColor: crest.borderColor,
            crestBgColor: crest.bgColor,
          },
        });

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "completed",
            processedItems: members.length,
            errorCount: upsertErrors + updateErrors,
            completedAt: new Date(),
            duration,
          },
        });

        await eventPublisher.publishDiscoveryComplete(
          guildId,
          members.length,
          updateSuccess,
          updateErrors,
          duration
        );

        console.log(
          `[Discovery] Completed for ${guild.name}: ${members.length} members, ${updateErrors} errors (${duration}s)`
        );
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const rawMsg = error instanceof Error ? error.message : String(error);
        const errorMsg = rawMsg.replace(/Bearer\s+\S+/g, "Bearer [REDACTED]").slice(0, 500);

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "failed",
            errorMessage: errorMsg,
            completedAt: new Date(),
            duration,
          },
        });

        await eventPublisher.publishError(
          guildId,
          `Discovery failed: ${errorMsg}`
        );
        await sendAlert({
          title: "Guild Discovery Failed",
          message: `Guild ${guild.name} (${guild.region}): ${errorMsg}`,
          level: "error",
          source: "worker/guild-discovery",
          emoji: "🔍",
        });
        throw error;
      }
    },
    { connection, concurrency: 3 }
  );
}
