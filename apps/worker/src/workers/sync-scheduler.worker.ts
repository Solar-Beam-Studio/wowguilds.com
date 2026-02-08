import { Worker, Queue, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { EventPublisher } from "../services/event-publisher.service";

const BATCH_SIZE = 40;

interface SchedulerJobData {
  guildId: string;
}

export function createSyncSchedulerWorker(
  connection: ConnectionOptions,
  eventPublisher: EventPublisher
) {
  const characterSyncQueue = new Queue(QUEUE_NAMES.CHARACTER_SYNC, {
    connection,
  });

  return new Worker<SchedulerJobData>(
    QUEUE_NAMES.SYNC_SCHEDULER,
    async (job: Job<SchedulerJobData>) => {
      const { guildId } = job.data;

      if (!guildId || typeof guildId !== "string") {
        throw new Error("Invalid job data: missing guildId");
      }

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild || !guild.syncEnabled) return;

      // Get active characters (within activity window)
      const cutoffTimestamp =
        Date.now() - guild.activityWindowDays * 24 * 60 * 60 * 1000;

      const activeMembers = await prisma.guildMember.findMany({
        where: {
          guildId,
          lastLoginTimestamp: { gte: BigInt(cutoffTimestamp) },
        },
        select: {
          characterName: true,
          realm: true,
          characterApiUrl: true,
          characterClass: true,
        },
        orderBy: { lastLoginTimestamp: "desc" },
      });

      if (activeMembers.length === 0) {
        console.log(
          `[Scheduler] No active members for guild ${guild.name}, skipping`
        );
        return;
      }

      // Create sync job record
      const syncJob = await prisma.syncJob.create({
        data: {
          guildId,
          type: "active_sync",
          status: "running",
          totalItems: activeMembers.length,
          startedAt: new Date(),
        },
      });

      // Split into batches and enqueue
      const batches: (typeof activeMembers)[] = [];
      for (let i = 0; i < activeMembers.length; i += BATCH_SIZE) {
        batches.push(activeMembers.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `[Scheduler] Enqueuing ${batches.length} batches (${activeMembers.length} characters) for guild ${guild.name}`
      );

      for (let i = 0; i < batches.length; i++) {
        await characterSyncQueue.add(
          `sync:${guildId}:batch:${i}`,
          {
            guildId,
            characters: batches[i],
            syncJobId: syncJob.id,
            batchIndex: i,
            totalBatches: batches.length,
          },
          { priority: 5 }
        );
      }

      // Update guild last active sync time
      await prisma.guild.update({
        where: { id: guildId },
        data: { lastActiveSyncAt: new Date() },
      });

      return { batches: batches.length, totalCharacters: activeMembers.length };
    },
    { connection, concurrency: 1 }
  );
}
