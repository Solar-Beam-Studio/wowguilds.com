import Redis from "ioredis";
import { getRedisConnection, createQueues } from "./queues";
import { BlizzardTokenService } from "./services/blizzard-token.service";
import { ExternalApiService } from "./services/external-api.service";
import { EventPublisher } from "./services/event-publisher.service";
import { OpenRouterService } from "./services/openrouter.service";
import { PirschService } from "./services/pirsch.service";
import { DataAggregationService } from "./services/data-aggregation.service";
import { IndexNowService } from "./services/indexnow.service";
import { GameContextService } from "./services/game-context.service";
import { createGuildDiscoveryWorker } from "./workers/guild-discovery.worker";
import { createCharacterSyncWorker } from "./workers/character-sync.worker";
import { createActivityCheckWorker } from "./workers/activity-check.worker";
import { createSyncSchedulerWorker } from "./workers/sync-scheduler.worker";
import { createGrowthStrategyWorker } from "./workers/growth-strategy.worker";
import { createGrowthGenerateWorker } from "./workers/growth-generate.worker";
import { createGrowthReviewWorker } from "./workers/growth-review.worker";
import { createGrowthRecapWorker } from "./workers/growth-recap.worker";
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
  const openRouter = new OpenRouterService(redis);
  const pirschService = new PirschService(redis);
  const dataAgg = new DataAggregationService();
  const indexNow = new IndexNowService();
  const gameCtx = new GameContextService();

  const queues = createQueues(connection);

  const workers = [
    createGuildDiscoveryWorker(connection, externalApi, eventPublisher),
    createCharacterSyncWorker(connection, externalApi, eventPublisher),
    createActivityCheckWorker(connection, externalApi, eventPublisher),
    createSyncSchedulerWorker(connection, eventPublisher),
    createGrowthStrategyWorker(connection, openRouter, pirschService, dataAgg, gameCtx),
    createGrowthGenerateWorker(connection, openRouter, dataAgg),
    createGrowthReviewWorker(connection, openRouter, indexNow),
    createGrowthRecapWorker(connection, pirschService, openRouter),
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

  // Register growth agent scheduled jobs
  await queues.growthStrategy.upsertJobScheduler(
    "growth:weekly-strategy",
    { pattern: "0 6 * * 1" }, // Monday 06:00 UTC
    { name: "growth:weekly-strategy", data: {} }
  );

  // Weekly analytics update (Thursday 06:00 UTC)
  await queues.growthStrategy.upsertJobScheduler(
    "growth:weekly-analytics",
    { pattern: "0 6 * * 4" },
    { name: "growth:weekly-analytics", data: { analyticsOnly: true } }
  );

  // Daily recap (20:00 UTC every day)
  await queues.growthRecap.upsertJobScheduler(
    "growth:daily-recap",
    { pattern: "0 20 * * *" },
    { name: "growth:daily-recap", data: {} }
  );

  console.log(`[Worker] Registered jobs for ${guilds.length} guilds + growth agent`);

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
