import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

export const guildDiscoveryQueue = new Queue("guild-discovery", { connection });
export const syncSchedulerQueue = new Queue("sync-scheduler", { connection });

export async function enqueueImmediateDiscovery(guildId: string) {
  await guildDiscoveryQueue.add(
    `discovery:${guildId}:immediate`,
    { guildId },
    { priority: 1 }
  );
}

export async function registerGuildSchedules(
  guildId: string,
  discoveryIntervalHours: number,
  activeSyncIntervalMin: number
) {
  await guildDiscoveryQueue.upsertJobScheduler(
    `discovery:${guildId}`,
    { every: discoveryIntervalHours * 60 * 60 * 1000 },
    { name: `discovery:${guildId}`, data: { guildId } }
  );

  await syncSchedulerQueue.upsertJobScheduler(
    `scheduler:${guildId}`,
    { every: activeSyncIntervalMin * 60 * 1000 },
    { name: `scheduler:${guildId}`, data: { guildId } }
  );
}

export async function removeGuildSchedules(guildId: string) {
  await guildDiscoveryQueue.removeJobScheduler(`discovery:${guildId}`);
  await syncSchedulerQueue.removeJobScheduler(`scheduler:${guildId}`);
}
