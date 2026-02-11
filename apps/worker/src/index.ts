import Redis from "ioredis";
import { getRedisConnection, createQueues } from "./queues";
import { BlizzardTokenService } from "./services/blizzard-token.service";
import { ExternalApiService } from "./services/external-api.service";
import { EventPublisher } from "./services/event-publisher.service";
import { createGuildDiscoveryWorker } from "./workers/guild-discovery.worker";
import { createCharacterSyncWorker } from "./workers/character-sync.worker";
import { createActivityCheckWorker } from "./workers/activity-check.worker";
import { createSyncSchedulerWorker } from "./workers/sync-scheduler.worker";
import { prisma, sendAlert } from "@wow/database";

async function main() {
  console.log("[Worker] Starting WoW Guild Sync worker service...");

  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = Number(process.env.REDIS_PORT) || 6379;
  const connection = getRedisConnection();
  const redis = new Redis({ host: redisHost, port: redisPort, password: process.env.REDIS_PASSWORD || undefined });

  const tokenService = new BlizzardTokenService(redis);
  const externalApi = new ExternalApiService(tokenService);
  const eventPublisher = new EventPublisher(redis);

  const queues = createQueues(connection);

  const workers = [
    createGuildDiscoveryWorker(connection, externalApi, eventPublisher),
    createCharacterSyncWorker(connection, externalApi, eventPublisher),
    createActivityCheckWorker(connection, externalApi, eventPublisher),
    createSyncSchedulerWorker(connection, eventPublisher),
  ];

  console.log(`[Worker] ${workers.length} workers started`);

  // Register repeatable jobs for all active guilds
  const guilds = await prisma.guild.findMany({
    where: { syncEnabled: true },
  });

  for (const guild of guilds) {
    await queues.guildDiscovery.upsertJobScheduler(
      `discovery:${guild.id}`,
      { every: guild.discoveryIntervalHours * 60 * 60 * 1000 },
      { name: `discovery:${guild.id}`, data: { guildId: guild.id } }
    );
    await queues.syncScheduler.upsertJobScheduler(
      `scheduler:${guild.id}`,
      { every: guild.activeSyncIntervalMin * 60 * 1000 },
      { name: `scheduler:${guild.id}`, data: { guildId: guild.id } }
    );
  }

  console.log(`[Worker] Registered jobs for ${guilds.length} guilds`);

  const shutdown = async () => {
    console.log("[Worker] Shutting down...");
    await Promise.all(workers.map((w) => w.close()));
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(async (error) => {
  console.error("[Worker] Fatal error:", error);
  await sendAlert({
    title: "Worker Process Crashed",
    message: error instanceof Error ? error.message : String(error),
    level: "error",
    source: "worker",
    emoji: "💀",
  });
  process.exit(1);
});
