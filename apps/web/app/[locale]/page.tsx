import { prisma } from "@wow/database";
import { setRequestLocale } from "next-intl/server";
import { HomeClient } from "./home-client";
import type { LeaderboardCategory, LeaderboardEntry } from "@/lib/leaderboard";
import {
  getItemLevelColor,
  getMythicPlusColor,
  getAchievementColor,
  getPvpRatingColor,
} from "@wow/database/constants";

export const dynamic = "force-dynamic";

function raidSortValue(raidProgress: string | null): number {
  if (!raidProgress) return 0;
  const diffOrder: Record<string, number> = { M: 4, H: 3, N: 2 };
  const diff = diffOrder[raidProgress.charAt(raidProgress.length - 1)] || 1;
  const num = parseInt(raidProgress.match(/\d+/)?.[0] || "0");
  return diff * 100 + num;
}

function toEntry(
  row: { characterName: string; characterClass: string | null; guild: { name: string; id: string } },
  value: string,
  colorClass: string
): LeaderboardEntry {
  return {
    name: row.characterName,
    characterClass: row.characterClass,
    value,
    colorClass,
    guildName: row.guild.name,
    guildId: row.guild.id,
  };
}

const memberSelect = {
  characterName: true,
  characterClass: true,
  guild: { select: { name: true, id: true } },
} as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    guilds,
    totalMembers,
    activeMembers,
    recentSyncJobs,
    topIlvl,
    topMplus,
    topAchievements,
    topPvp2v2,
    topPvp3v3,
    topSolo,
    topRbg,
    topBlitz,
    raidCandidates,
  ] = await Promise.all([
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
    prisma.syncJob.findMany({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      take: 15,
      select: {
        id: true,
        type: true,
        totalItems: true,
        processedItems: true,
        completedAt: true,
        duration: true,
        guild: { select: { name: true, id: true, realm: true, region: true } },
      },
    }),
    prisma.guildMember.findMany({
      where: { itemLevel: { gt: 0 } },
      orderBy: { itemLevel: "desc" },
      take: 3,
      select: { ...memberSelect, itemLevel: true },
    }),
    prisma.guildMember.findMany({
      where: { mythicPlusScore: { gt: 0 } },
      orderBy: { mythicPlusScore: "desc" },
      take: 3,
      select: { ...memberSelect, mythicPlusScore: true },
    }),
    prisma.guildMember.findMany({
      where: { achievementPoints: { gt: 0 } },
      orderBy: { achievementPoints: "desc" },
      take: 3,
      select: { ...memberSelect, achievementPoints: true },
    }),
    prisma.guildMember.findMany({
      where: { pvp2v2Rating: { gt: 0 } },
      orderBy: { pvp2v2Rating: "desc" },
      take: 3,
      select: { ...memberSelect, pvp2v2Rating: true },
    }),
    prisma.guildMember.findMany({
      where: { pvp3v3Rating: { gt: 0 } },
      orderBy: { pvp3v3Rating: "desc" },
      take: 3,
      select: { ...memberSelect, pvp3v3Rating: true },
    }),
    prisma.guildMember.findMany({
      where: { soloShuffleRating: { gt: 0 } },
      orderBy: { soloShuffleRating: "desc" },
      take: 3,
      select: { ...memberSelect, soloShuffleRating: true },
    }),
    prisma.guildMember.findMany({
      where: { pvpRbgRating: { gt: 0 } },
      orderBy: { pvpRbgRating: "desc" },
      take: 3,
      select: { ...memberSelect, pvpRbgRating: true },
    }),
    prisma.guildMember.findMany({
      where: { rbgShuffleRating: { gt: 0 } },
      orderBy: { rbgShuffleRating: "desc" },
      take: 3,
      select: { ...memberSelect, rbgShuffleRating: true },
    }),
    prisma.guildMember.findMany({
      where: { raidProgress: { not: null } },
      take: 200,
      select: { ...memberSelect, raidProgress: true },
    }),
  ]);

  // Sort raid progress in JS (string field, can't sort in Prisma)
  const topRaids = raidCandidates
    .sort((a, b) => raidSortValue(b.raidProgress) - raidSortValue(a.raidProgress))
    .slice(0, 3);

  const leaderboardCategories: LeaderboardCategory[] = [
    {
      id: "itemLevel",
      icon: "🗡️",
      accentColor: "border-purple-500",
      entries: topIlvl.map((r) =>
        toEntry(r, String(Math.round(r.itemLevel!)), getItemLevelColor(r.itemLevel!))
      ),
    },
    {
      id: "mythicPlus",
      icon: "🏆",
      accentColor: "border-orange-500",
      entries: topMplus.map((r) =>
        toEntry(
          r,
          r.mythicPlusScore! % 1 === 0
            ? String(r.mythicPlusScore)
            : r.mythicPlusScore!.toFixed(1),
          getMythicPlusColor(r.mythicPlusScore!)
        )
      ),
    },
    {
      id: "raids",
      icon: "🏰",
      accentColor: "border-amber-500",
      entries: topRaids.map((r) =>
        toEntry(r, r.raidProgress!, "text-amber-500")
      ),
    },
    {
      id: "achievements",
      icon: "⭐",
      accentColor: "border-yellow-500",
      entries: topAchievements.map((r) =>
        toEntry(
          r,
          r.achievementPoints.toLocaleString(locale),
          getAchievementColor(r.achievementPoints)
        )
      ),
    },
    {
      id: "pvp2v2",
      icon: "⚔️",
      accentColor: "border-red-500",
      entries: topPvp2v2.map((r) =>
        toEntry(r, String(r.pvp2v2Rating), getPvpRatingColor(r.pvp2v2Rating))
      ),
    },
    {
      id: "pvp3v3",
      icon: "⚔️",
      accentColor: "border-red-500",
      entries: topPvp3v3.map((r) =>
        toEntry(r, String(r.pvp3v3Rating), getPvpRatingColor(r.pvp3v3Rating))
      ),
    },
    {
      id: "pvpSolo",
      icon: "🎯",
      accentColor: "border-pink-500",
      entries: topSolo.map((r) =>
        toEntry(r, String(r.soloShuffleRating), getPvpRatingColor(r.soloShuffleRating))
      ),
    },
    {
      id: "pvpRbg",
      icon: "🛡️",
      accentColor: "border-emerald-500",
      entries: topRbg.map((r) =>
        toEntry(r, String(r.pvpRbgRating), getPvpRatingColor(r.pvpRbgRating))
      ),
    },
    {
      id: "pvpBlitz",
      icon: "⚡",
      accentColor: "border-cyan-500",
      entries: topBlitz.map((r) =>
        toEntry(r, String(r.rbgShuffleRating), getPvpRatingColor(r.rbgShuffleRating))
      ),
    },
  ];

  const recentActivity = recentSyncJobs.map((job) => ({
    id: job.id,
    type: job.type,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    completedAt: job.completedAt?.toISOString() ?? null,
    duration: job.duration,
    guildName: job.guild.name,
    guildId: job.guild.id,
    guildRealm: job.guild.realm,
    guildRegion: job.guild.region,
  }));

  return (
    <HomeClient
      guilds={guilds}
      totalMembers={totalMembers}
      activeMembers={activeMembers}
      leaderboardCategories={leaderboardCategories}
      recentActivity={recentActivity}
    />
  );
}
