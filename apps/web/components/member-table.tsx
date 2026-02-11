"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ExternalLink } from "lucide-react";
import {
  CLASS_COLORS,
  getPvpRatingColor,
  getItemLevelColor,
  getMythicPlusColor,
  getAchievementColor,
  getVaultColor,
} from "@wow/database/constants";
import type { GuildMember } from "@/hooks/use-members";
import { DataTable, type Column } from "@/components/data-table";

interface MemberTableProps {
  members: GuildMember[];
  region: string;
  search: string;
}

function ratingColor(value: number | null, type: "pvp" | "itemLevel" | "mythicPlus" | "achievement"): string {
  if (value === null || value === undefined || value === 0) return "text-[var(--text-secondary)] opacity-20";
  switch (type) {
    case "pvp": return getPvpRatingColor(value);
    case "itemLevel": return getItemLevelColor(value);
    case "mythicPlus": return getMythicPlusColor(value);
    case "achievement": return getAchievementColor(value);
  }
}

function raidSortValue(raidProgress: string | null): number {
  if (!raidProgress) return 0;
  const diffOrder: Record<string, number> = { M: 4, H: 3, N: 2 };
  const diff = diffOrder[raidProgress.charAt(raidProgress.length - 1)] || 1;
  const num = parseInt(raidProgress.match(/\d+/)?.[0] || "0");
  return diff * 100 + num;
}

export function MemberTable({ members, region, search }: MemberTableProps) {
  const t = useTranslations("table");
  const locale = useLocale();

  const filtered = useMemo(() => {
    if (!search) return members;
    const lower = search.toLowerCase();
    return members.filter(
      (m) =>
        m.characterName.toLowerCase().includes(lower) ||
        m.realm.toLowerCase().includes(lower) ||
        m.characterClass?.toLowerCase().includes(lower)
    );
  }, [members, search]);

  const getArmoryLink = (name: string, realm: string) =>
    `https://worldofwarcraft.blizzard.com/en-us/character/${region}/${realm}/${name}`;

  const columns: Column<GuildMember>[] = [
    {
      key: "characterName",
      label: t("character"),
      align: "left",
      sticky: true,
      sortValue: (m) => m.characterName.toLowerCase(),
      render: (m) => (
        <div className="flex items-center gap-3 font-medium">
          <div className="flex flex-col">
            <span
              className="text-[0.9375rem] font-medium tracking-tight transition-opacity group-hover:opacity-80"
              style={{ color: (m.characterClass && CLASS_COLORS[m.characterClass]) || "var(--text)" }}
            >
              {m.characterName}
            </span>
            <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">
              {m.characterClass} • {m.realm}
            </span>
          </div>
          <a
            href={getArmoryLink(m.characterName, m.realm)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ),
    },
    {
      key: "level",
      label: t("level"),
      align: "right",
      sortValue: (m) => m.level ?? 0,
      render: (m) => (
        <span className="font-mono text-[0.8125rem] opacity-30 tabular-nums">{m.level || "-"}</span>
      ),
    },
    {
      key: "activityStatus",
      label: t("status"),
      align: "center",
      sortValue: (m) => (m.activityStatus === "active" ? 1 : 0),
      render: (m) => (
        <div className="flex justify-center">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              m.activityStatus === "active"
                ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                : "bg-red-500/20"
            }`}
            title={m.activityStatus || "unknown"}
          />
        </div>
      ),
    },
    {
      key: "itemLevel",
      label: t("itemLevel"),
      align: "right",
      sortValue: (m) => m.itemLevel ?? 0,
      render: (m) => (
        <span className={`text-[0.9375rem] font-mono font-medium tracking-tight tabular-nums ${ratingColor(m.itemLevel, "itemLevel")}`}>
          {m.itemLevel ? Math.round(m.itemLevel) : "-"}
        </span>
      ),
    },
    {
      key: "mythicPlusScore",
      label: t("mythicPlus"),
      align: "right",
      sortValue: (m) => m.mythicPlusScore ?? 0,
      render: (m) => (
        <span className={`text-[0.9375rem] font-mono font-medium tracking-tight tabular-nums ${ratingColor(m.mythicPlusScore, "mythicPlus")}`}>
          {m.mythicPlusScore ? Math.round(m.mythicPlusScore) : "-"}
        </span>
      ),
    },
    {
      key: "weeklyKeysCompleted",
      label: t("vault"),
      align: "right",
      sortValue: (m) => m.weeklyKeysCompleted ?? 0,
      render: (m) => {
        const runs = m.weeklyKeysCompleted ?? 0;
        const s1 = m.weeklyBestKeyLevel ?? 0;
        const s2 = m.weeklySlot2KeyLevel ?? 0;
        const s3 = m.weeklySlot3KeyLevel ?? 0;
        const slots = runs >= 8 ? 3 : runs >= 4 ? 2 : runs >= 1 ? 1 : 0;
        const slotLines = [
          s1 > 0 ? `Slot 1: +${s1}` : null,
          runs >= 4 && s2 > 0 ? `Slot 2: +${s2}` : runs >= 1 && runs < 4 ? `Slot 2: ${4 - runs} more runs` : null,
          runs >= 8 && s3 > 0 ? `Slot 3: +${s3}` : runs >= 4 && runs < 8 ? `Slot 3: ${8 - runs} more runs` : null,
        ].filter(Boolean);
        const tooltip = runs > 0
          ? `${runs} M+ runs → ${slots}/3 vault slots\n${slotLines.join("\n")}`
          : "No M+ runs this week";
        return (
          <span
            className={`text-[0.8125rem] font-mono font-medium tabular-nums ${getVaultColor(runs)}`}
            title={tooltip}
          >
            {runs > 0 ? `${runs}/8` : "-"}
            {s1 > 0 && <span className="text-[0.6875rem] opacity-50 ml-1">+{s1}</span>}
          </span>
        );
      },
    },
    {
      key: "raidProgress",
      label: t("raids"),
      align: "right",
      sortValue: (m) => raidSortValue(m.raidProgress),
      render: (m) =>
        m.raidProgress ? (
          <span className="font-mono text-amber-500 font-medium tracking-tight tabular-nums">{m.raidProgress}</span>
        ) : (
          <span className="text-[var(--text-secondary)] opacity-10">-</span>
        ),
    },
    {
      key: "achievementPoints",
      label: t("achievements"),
      align: "right",
      sortValue: (m) => m.achievementPoints ?? 0,
      render: (m) => (
        <span className={`text-[0.8125rem] font-mono font-medium tabular-nums ${ratingColor(m.achievementPoints, "achievement")}`}>
          {m.achievementPoints?.toLocaleString(locale) || "-"}
        </span>
      ),
    },
    ...([
      { key: "pvp2v2Rating", label: t("pvp2v2") },
      { key: "pvp3v3Rating", label: t("pvp3v3") },
      { key: "pvpRbgRating", label: t("pvpRbg") },
      { key: "soloShuffleRating", label: t("pvpSolo") },
      { key: "rbgShuffleRating", label: t("pvpBlitz") },
    ] as const).map((pvp) => ({
      key: pvp.key,
      label: pvp.label,
      align: "right" as const,
      sortValue: (m: GuildMember) => (m[pvp.key as keyof GuildMember] as number | null) ?? 0,
      render: (m: GuildMember) => {
        const val = m[pvp.key as keyof GuildMember] as number | null;
        return (
          <span className={`text-[0.8125rem] font-mono font-medium tabular-nums ${ratingColor(val, "pvp")}`}>
            {val || "-"}
          </span>
        );
      },
    })),
    {
      key: "lastUpdated",
      label: t("updated"),
      align: "right",
      sortValue: (m) => (m.lastUpdated ? new Date(m.lastUpdated).getTime() : 0),
      render: (m) => (
        <span className="text-[10px] font-mono font-medium text-[var(--text-secondary)] opacity-20 tabular-nums uppercase">
          {m.lastUpdated
            ? new Date(m.lastUpdated).toLocaleDateString(locale, { month: "short", day: "numeric" })
            : "-"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={filtered}
      rowKey={(m) => `${m.characterName}-${m.realm}`}
      defaultSortKey="itemLevel"
      defaultSortDirection="desc"
      emptyMessage={t("noResults")}
    />
  );
}
