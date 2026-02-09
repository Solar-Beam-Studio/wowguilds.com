import {
  getItemLevelColor,
  getMythicPlusColor,
  getAchievementColor,
  getPvpRatingColor,
} from "@wow/database/constants";
import type { GuildMember } from "@/hooks/use-members";

export interface LeaderboardEntry {
  name: string;
  characterClass: string | null;
  value: string;
  colorClass: string;
  guildName?: string;
  guildId?: string;
}

export interface LeaderboardCategory {
  id: string;
  icon: string;
  accentColor: string;
  entries: LeaderboardEntry[];
}

export function raidSortValue(raidProgress: string | null): number {
  if (!raidProgress) return 0;
  const diffOrder: Record<string, number> = { M: 4, H: 3, N: 2 };
  const diff = diffOrder[raidProgress.charAt(raidProgress.length - 1)] || 1;
  const num = parseInt(raidProgress.match(/\d+/)?.[0] || "0");
  return diff * 100 + num;
}

export function getTop3(
  members: GuildMember[],
  getValue: (m: GuildMember) => number,
  formatValue: (m: GuildMember) => string,
  colorFn: (value: number) => string
): LeaderboardEntry[] {
  return members
    .filter((m) => getValue(m) > 0)
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, 3)
    .map((m) => ({
      name: m.characterName,
      characterClass: m.characterClass,
      value: formatValue(m),
      colorClass: colorFn(getValue(m)),
    }));
}

interface CategoryConfig {
  id: string;
  icon: string;
  accentColor: string;
  getValue: (m: GuildMember) => number;
  formatValue: (m: GuildMember, locale?: string) => string;
  colorFn: (value: number) => string;
}

export const LEADERBOARD_CATEGORIES: CategoryConfig[] = [
  {
    id: "itemLevel",
    icon: "🗡️",
    accentColor: "border-purple-500",
    getValue: (m) => m.itemLevel ?? 0,
    formatValue: (m) => String(Math.round(m.itemLevel!)),
    colorFn: getItemLevelColor,
  },
  {
    id: "mythicPlus",
    icon: "🏆",
    accentColor: "border-orange-500",
    getValue: (m) => m.mythicPlusScore ?? 0,
    formatValue: (m) =>
      m.mythicPlusScore! % 1 === 0
        ? String(m.mythicPlusScore)
        : m.mythicPlusScore!.toFixed(1),
    colorFn: getMythicPlusColor,
  },
  {
    id: "raids",
    icon: "🏰",
    accentColor: "border-amber-500",
    getValue: (m) => raidSortValue(m.raidProgress),
    formatValue: (m) => m.raidProgress!,
    colorFn: () => "text-amber-500",
  },
  {
    id: "achievements",
    icon: "⭐",
    accentColor: "border-yellow-500",
    getValue: (m) => m.achievementPoints ?? 0,
    formatValue: (m, locale) => m.achievementPoints.toLocaleString(locale),
    colorFn: getAchievementColor,
  },
  {
    id: "pvp2v2",
    icon: "⚔️",
    accentColor: "border-red-500",
    getValue: (m) => m.pvp2v2Rating,
    formatValue: (m) => String(m.pvp2v2Rating),
    colorFn: getPvpRatingColor,
  },
  {
    id: "pvp3v3",
    icon: "⚔️",
    accentColor: "border-red-500",
    getValue: (m) => m.pvp3v3Rating,
    formatValue: (m) => String(m.pvp3v3Rating),
    colorFn: getPvpRatingColor,
  },
  {
    id: "pvpSolo",
    icon: "🎯",
    accentColor: "border-pink-500",
    getValue: (m) => m.soloShuffleRating,
    formatValue: (m) => String(m.soloShuffleRating),
    colorFn: getPvpRatingColor,
  },
  {
    id: "pvpRbg",
    icon: "🛡️",
    accentColor: "border-emerald-500",
    getValue: (m) => m.pvpRbgRating,
    formatValue: (m) => String(m.pvpRbgRating),
    colorFn: getPvpRatingColor,
  },
  {
    id: "pvpBlitz",
    icon: "⚡",
    accentColor: "border-cyan-500",
    getValue: (m) => m.rbgShuffleRating,
    formatValue: (m) => String(m.rbgShuffleRating),
    colorFn: getPvpRatingColor,
  },
];

export function buildCategories(
  members: GuildMember[],
  locale?: string
): LeaderboardCategory[] {
  return LEADERBOARD_CATEGORIES.map((config) => ({
    id: config.id,
    icon: config.icon,
    accentColor: config.accentColor,
    entries: getTop3(
      members,
      config.getValue,
      (m) => config.formatValue(m, locale),
      config.colorFn
    ),
  }));
}
