import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wow/database";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const realm = request.nextUrl.searchParams.get("realm")?.trim().toLowerCase();
  const region = request.nextUrl.searchParams.get("region")?.trim().toLowerCase() || "eu";

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const guilds = await prisma.guild.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(realm ? { realm } : {}),
        region,
      },
      select: {
        id: true,
        name: true,
        realm: true,
        region: true,
        memberCount: true,
      },
      orderBy: { memberCount: "desc" },
      take: 5,
    });

    return NextResponse.json(guilds);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
