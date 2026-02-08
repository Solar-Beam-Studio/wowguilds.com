import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wow/database";
import { requireSession } from "@/lib/session";
import { removeGuildSchedules } from "@/lib/queue";

async function getOwnedGuild(guildId: string, userId: string) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });
  if (!guild || guild.userId !== userId) return null;
  return guild;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await requireSession();
    const { guildId } = await params;
    const guild = await getOwnedGuild(guildId, session.user.id);

    if (!guild) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    return NextResponse.json(guild);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch guild" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await requireSession();
    const { guildId } = await params;
    const guild = await getOwnedGuild(guildId, session.user.id);

    if (!guild) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if ("syncEnabled" in body) {
      if (typeof body.syncEnabled !== "boolean") {
        return NextResponse.json({ error: "syncEnabled must be a boolean" }, { status: 400 });
      }
      updateData.syncEnabled = body.syncEnabled;
    }
    if ("discoveryIntervalHours" in body) {
      if (typeof body.discoveryIntervalHours !== "number" || body.discoveryIntervalHours < 1 || body.discoveryIntervalHours > 168) {
        return NextResponse.json({ error: "discoveryIntervalHours must be 1-168" }, { status: 400 });
      }
      updateData.discoveryIntervalHours = body.discoveryIntervalHours;
    }
    if ("activeSyncIntervalMin" in body) {
      if (typeof body.activeSyncIntervalMin !== "number" || body.activeSyncIntervalMin < 5 || body.activeSyncIntervalMin > 1440) {
        return NextResponse.json({ error: "activeSyncIntervalMin must be 5-1440" }, { status: 400 });
      }
      updateData.activeSyncIntervalMin = body.activeSyncIntervalMin;
    }
    if ("activityWindowDays" in body) {
      if (typeof body.activityWindowDays !== "number" || body.activityWindowDays < 1 || body.activityWindowDays > 365) {
        return NextResponse.json({ error: "activityWindowDays must be 1-365" }, { status: 400 });
      }
      updateData.activityWindowDays = body.activityWindowDays;
    }

    const updated = await prisma.guild.update({
      where: { id: guildId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update guild" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await requireSession();
    const { guildId } = await params;
    const guild = await getOwnedGuild(guildId, session.user.id);

    if (!guild) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    // Remove scheduled jobs
    await removeGuildSchedules(guildId);

    // Cascade delete via Prisma relations
    await prisma.guild.delete({ where: { id: guildId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete guild" },
      { status: 500 }
    );
  }
}
