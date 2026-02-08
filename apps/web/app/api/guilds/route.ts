import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wow/database";
import { requireSession } from "@/lib/session";
import {
  enqueueImmediateDiscovery,
  registerGuildSchedules,
} from "@/lib/queue";

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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
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

    const guild = await prisma.guild.create({
      data: {
        name,
        realm: realm.toLowerCase(),
        region: region.toLowerCase(),
        userId: session.user.id,
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "This guild is already being tracked" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create guild" },
      { status: 500 }
    );
  }
}
