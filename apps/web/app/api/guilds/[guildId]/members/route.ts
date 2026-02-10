import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wow/database";

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

    const members = await prisma.guildMember.findMany({
      where: { guildId },
      orderBy: [{ itemLevel: "desc" }, { characterName: "asc" }],
    });

    // Convert BigInt to number for JSON serialization
    const serialized = members.map((m) => ({
      ...m,
      lastLoginTimestamp: m.lastLoginTimestamp
        ? Number(m.lastLoginTimestamp)
        : null,
    }));

    return NextResponse.json({ members: serialized, count: serialized.length });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
