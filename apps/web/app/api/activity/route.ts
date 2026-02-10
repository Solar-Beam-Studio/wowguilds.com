import { NextRequest } from "next/server";
import Redis from "ioredis";
import { prisma } from "@wow/database";

const MAX_CONNECTION_MS = 10 * 60 * 1000; // 10 min max (shorter than guild SSE)
const HEARTBEAT_INTERVAL_MS = 30_000;

// In-memory guild cache (avoids DB hit per event)
interface CachedGuild {
  name: string;
  realm: string;
  region: string;
  crestEmblemId: number | null;
  crestEmblemColor: string | null;
  crestBorderId: number | null;
  crestBorderColor: string | null;
  crestBgColor: string | null;
}

const guildCache = new Map<string, CachedGuild>();

async function resolveGuild(guildId: string) {
  const cached = guildCache.get(guildId);
  if (cached) return cached;

  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: {
      name: true, realm: true, region: true,
      crestEmblemId: true, crestEmblemColor: true,
      crestBorderId: true, crestBorderColor: true, crestBgColor: true,
    },
  });

  if (guild) {
    guildCache.set(guildId, guild);
    setTimeout(() => guildCache.delete(guildId), 5 * 60 * 1000);
  }

  return guild;
}

export async function GET(_request: NextRequest) {
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });

    let closed = false;

    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(maxLifeTimer);
      redis.punsubscribe("guild:*:sync").catch(() => {});
      redis.quit().catch(() => {});
    }

    let heartbeat: ReturnType<typeof setInterval>;
    let maxLifeTimer: ReturnType<typeof setTimeout>;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const safeSend = (data: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            cleanup();
          }
        };

        safeSend(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

        redis.psubscribe("guild:*:sync").catch(() => {
          cleanup();
          try { controller.close(); } catch {}
        });

        redis.on("pmessage", async (_pattern: string, _channel: string, message: string) => {
          try {
            const event = JSON.parse(message);
            // Only forward guild-level events (not per-character noise)
            if (!["discovery:complete", "sync:complete"].includes(event.type)) return;

            const guild = await resolveGuild(event.guildId);
            if (guild) {
              event.guildName = guild.name;
              event.guildRealm = guild.realm;
              event.guildRegion = guild.region;
              event.crestEmblemId = guild.crestEmblemId;
              event.crestEmblemColor = guild.crestEmblemColor;
              event.crestBorderId = guild.crestBorderId;
              event.crestBorderColor = guild.crestBorderColor;
              event.crestBgColor = guild.crestBgColor;
            }

            safeSend(`data: ${JSON.stringify(event)}\n\n`);
          } catch {
            // Ignore malformed messages
          }
        });

        redis.on("error", () => {
          cleanup();
          try { controller.close(); } catch {}
        });

        heartbeat = setInterval(() => {
          safeSend(`:heartbeat\n\n`);
        }, HEARTBEAT_INTERVAL_MS);

        maxLifeTimer = setTimeout(() => {
          cleanup();
          try { controller.close(); } catch {}
        }, MAX_CONNECTION_MS);
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
