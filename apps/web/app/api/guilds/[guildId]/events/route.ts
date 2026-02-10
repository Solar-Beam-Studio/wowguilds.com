import { NextRequest } from "next/server";
import Redis from "ioredis";
import { prisma } from "@wow/database";

const MAX_CONNECTION_MS = 30 * 60 * 1000; // 30 minutes max per SSE connection
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s heartbeat

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params;

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { id: true },
    });
    if (!guild) {
      return new Response("Guild not found", { status: 404 });
    }

    const redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });

    const channel = `guild:${guildId}:sync`;
    let closed = false;

    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(maxLifeTimer);
      redis.unsubscribe(channel).catch(() => {});
      redis.quit().catch(() => {});
    }

    // Heartbeat to detect dead connections
    let heartbeat: ReturnType<typeof setInterval>;
    // Max lifetime to prevent zombie connections
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

        // Send initial connection event
        safeSend(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

        redis.subscribe(channel).catch(() => {
          cleanup();
          try { controller.close(); } catch {}
        });

        redis.on("message", (_ch: string, message: string) => {
          safeSend(`data: ${message}\n\n`);
        });

        redis.on("error", () => {
          cleanup();
          try { controller.close(); } catch {}
        });

        // Heartbeat — if enqueue fails, client is gone
        heartbeat = setInterval(() => {
          safeSend(`:heartbeat\n\n`);
        }, HEARTBEAT_INTERVAL_MS);

        // Force close after max lifetime
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
