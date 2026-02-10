import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@wow/database";
import { requireSession } from "@/lib/session";
import {
  enqueueImmediateDiscovery,
  registerGuildSchedules,
} from "@/lib/queue";
import { validateGuildExists } from "@/lib/blizzard";

// In-memory rate limit: 10 req/min per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
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

// GET — auth-protected, returns user's guilds (for /guilds dashboard)
export async function GET() {
  try {
    const session = await requireSession();

    const guilds = await prisma.guild.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json(guilds);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch guilds" },
      { status: 500 }
    );
  }
}

// POST — public lookup-or-create
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { name, realm, region } = body;

    if (!name || !realm || !region) {
      return NextResponse.json(
        { error: "name, realm, and region are required" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || typeof realm !== "string" || typeof region !== "string") {
      return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
    }

    if (name.length > 100 || realm.length > 100) {
      return NextResponse.json({ error: "Name or realm too long" }, { status: 400 });
    }

    const validRegions = ["us", "eu", "kr", "tw", "cn"];
    if (!validRegions.includes(region.toLowerCase())) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    const normalizedRealm = realm.toLowerCase();
    const normalizedRegion = region.toLowerCase();

    // Lookup existing guild
    const existing = await prisma.guild.findUnique({
      where: { name_realm_region: { name, realm: normalizedRealm, region: normalizedRegion } },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    // Validate guild exists on Blizzard before creating
    const exists = await validateGuildExists(name, normalizedRealm, normalizedRegion);
    if (!exists) {
      return NextResponse.json(
        { error: "Guild not found on Blizzard. Check the name, realm, and region." },
        { status: 404 }
      );
    }

    // Create new guild (no userId — public lookup)
    try {
      const guild = await prisma.guild.create({
        data: {
          name,
          realm: normalizedRealm,
          region: normalizedRegion,
        },
      });

      // Register repeatable sync jobs
      await registerGuildSchedules(
        guild.id,
        guild.discoveryIntervalHours,
        guild.activeSyncIntervalMin
      );

      // Trigger immediate discovery
      await enqueueImmediateDiscovery(guild.id);

      return NextResponse.json(guild, { status: 201 });
    } catch (error) {
      // P2002 race condition: another request created it first
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.guild.findUnique({
          where: { name_realm_region: { name, realm: normalizedRealm, region: normalizedRegion } },
        });
        if (existing) {
          return NextResponse.json(existing);
        }
      }
      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to lookup guild" },
      { status: 500 }
    );
  }
}
