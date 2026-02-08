import { prisma } from "@wow/database";
import { HomeClient } from "./home-client";

export const revalidate = 60;

export default async function HomePage() {
  const [guilds, totalMembers, activeMembers, topCharacters] = await Promise.all([
    prisma.guild.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        realm: true,
        region: true,
        memberCount: true,
        lastActiveSyncAt: true,
      },
    }),
    prisma.guildMember.count(),
    prisma.guildMember.count({
      where: {
        lastLoginTimestamp: {
          gte: BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.guildMember.findMany({
      where: { itemLevel: { not: null } },
      orderBy: { itemLevel: "desc" },
      take: 10,
      select: {
        characterName: true,
        realm: true,
        characterClass: true,
        itemLevel: true,
        mythicPlusScore: true,
        guild: { select: { name: true, id: true } },
      },
    }),
  ]);

  return (
    <HomeClient
      guilds={guilds}
      totalMembers={totalMembers}
      activeMembers={activeMembers}
      topCharacters={topCharacters}
    />
  );
}
