import { Worker, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { ExternalApiService } from "../services/external-api.service";
import type { EventPublisher } from "../services/event-publisher.service";

interface ActivityCheckJobData {
  guildId: string;
  characters: Array<{ characterName: string; realm: string }>;
}

export function createActivityCheckWorker(
  connection: ConnectionOptions,
  externalApi: ExternalApiService,
  eventPublisher: EventPublisher
) {
  return new Worker<ActivityCheckJobData>(
    QUEUE_NAMES.ACTIVITY_CHECK,
    async (job: Job<ActivityCheckJobData>) => {
      const { guildId, characters } = job.data;

      if (!guildId || typeof guildId !== "string" || !Array.isArray(characters)) {
        throw new Error("Invalid job data: missing required fields");
      }

      console.log(
        `[ActivityCheck] Checking ${characters.length} characters for guild ${guildId}`
      );

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return;

      const results = await externalApi.bulkCheckActivity(
        characters.map((c) => ({ name: c.characterName, realm: c.realm })),
        guild.region
      );

      let updated = 0;
      let errors = 0;

      for (const result of results) {
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
          updated++;
        } catch {
          errors++;
        }
      }

      console.log(
        `[ActivityCheck] Done: ${updated} updated, ${errors} errors`
      );
      return { updated, errors };
    },
    { connection, concurrency: 3 }
  );
}
