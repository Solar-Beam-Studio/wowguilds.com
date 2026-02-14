import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

export const QUEUE_NAMES = {
  GUILD_DISCOVERY: "guild-discovery",
  CHARACTER_SYNC: "character-sync",
  ACTIVITY_CHECK: "activity-check",
  SYNC_SCHEDULER: "sync-scheduler",
  GROWTH_STRATEGY: "growth-strategy",
  GROWTH_GENERATE: "growth-generate",
  GROWTH_REVIEW: "growth-review",
  GROWTH_RECAP: "growth-recap",
} as const;

export function getRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

export function createQueues(connection: ConnectionOptions) {
  return {
    guildDiscovery: new Queue(QUEUE_NAMES.GUILD_DISCOVERY, { connection }),
    characterSync: new Queue(QUEUE_NAMES.CHARACTER_SYNC, { connection }),
    activityCheck: new Queue(QUEUE_NAMES.ACTIVITY_CHECK, { connection }),
    syncScheduler: new Queue(QUEUE_NAMES.SYNC_SCHEDULER, { connection }),
    growthStrategy: new Queue(QUEUE_NAMES.GROWTH_STRATEGY, { connection }),
    growthGenerate: new Queue(QUEUE_NAMES.GROWTH_GENERATE, { connection }),
    growthReview: new Queue(QUEUE_NAMES.GROWTH_REVIEW, { connection }),
    growthRecap: new Queue(QUEUE_NAMES.GROWTH_RECAP, { connection }),
  };
}
