import { NextRequest, NextResponse } from "next/server";
import { prisma, sendAlert } from "@wow/database";
import { enqueueImmediateDiscovery } from "@/lib/queue";

// In-memory rate limit: 5 req/min per IP for sync triggers
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

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
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    const jobs = await prisma.syncJob.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(jobs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { guildId } = await params;

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { id: true },
    });
    if (!guild) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    await enqueueImmediateDiscovery(guildId);

    return NextResponse.json({ message: "Sync triggered" });
  } catch (error) {
    sendAlert({
      title: "Sync Trigger Failed",
      message: error instanceof Error ? error.message : String(error),
      level: "error",
      source: "web/sync-trigger",
      emoji: "🔄",
    });
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
