"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CLASS_COLORS,
  getItemLevelColor,
  getMythicPlusColor,
  getAchievementColor,
} from "@wow/database/constants";
import type { GuildMember } from "@/hooks/use-members";

function Bar({
  value,
  max,
  color,
  label,
  count,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  count: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400 truncate text-right">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-xs font-mono tabular-nums text-gray-500 text-right">
        {count}
      </span>
    </div>
  );
}

export function AnalyticsTab({ members }: { members: GuildMember[] }) {
  const t = useTranslations("analytics");

  const stats = useMemo(() => {
    const classCounts: Record<string, number> = {};
    let totalIlvl = 0;
    let ilvlCount = 0;
    let totalMplus = 0;
    let mplusCount = 0;
    let totalAchiev = 0;
    let achievCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    // Only count members with actual data (exclude zeros)
    const ilvlBuckets = { "650+": 0, "620-649": 0, "590-619": 0, "560-589": 0, "<560": 0 };
    const mplusBuckets = { "3000+": 0, "2500-2999": 0, "2000-2499": 0, "1500-1999": 0, "1-1499": 0 };
    const raidBuckets = { Mythic: 0, Heroic: 0, Normal: 0 };

    for (const m of members) {
      if (m.characterClass) {
        classCounts[m.characterClass] = (classCounts[m.characterClass] || 0) + 1;
      }

      if (m.itemLevel && m.itemLevel > 0) {
        totalIlvl += m.itemLevel;
        ilvlCount++;

        if (m.itemLevel >= 650) ilvlBuckets["650+"]++;
        else if (m.itemLevel >= 620) ilvlBuckets["620-649"]++;
        else if (m.itemLevel >= 590) ilvlBuckets["590-619"]++;
        else if (m.itemLevel >= 560) ilvlBuckets["560-589"]++;
        else ilvlBuckets["<560"]++;
      }

      if (m.mythicPlusScore && m.mythicPlusScore > 0) {
        totalMplus += m.mythicPlusScore;
        mplusCount++;

        if (m.mythicPlusScore >= 3000) mplusBuckets["3000+"]++;
        else if (m.mythicPlusScore >= 2500) mplusBuckets["2500-2999"]++;
        else if (m.mythicPlusScore >= 2000) mplusBuckets["2000-2499"]++;
        else if (m.mythicPlusScore >= 1500) mplusBuckets["1500-1999"]++;
        else mplusBuckets["1-1499"]++;
      }

      if (m.achievementPoints > 0) {
        totalAchiev += m.achievementPoints;
        achievCount++;
      }

      if (m.activityStatus === "active") activeCount++;
      else inactiveCount++;

      const rp = m.raidProgress ?? "";
      if (/\bM$/i.test(rp) || /mythic/i.test(rp)) raidBuckets.Mythic++;
      else if (/\bH$/i.test(rp) || /heroic/i.test(rp)) raidBuckets.Heroic++;
      else if (/\bN$/i.test(rp) || /normal/i.test(rp)) raidBuckets.Normal++;
    }

    const classDistribution = Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1]);
    const maxClassCount = classDistribution[0]?.[1] ?? 0;

    const avgIlvl = ilvlCount > 0 ? Math.round(totalIlvl / ilvlCount) : 0;
    const avgMplus = mplusCount > 0 ? Math.round(totalMplus / mplusCount) : 0;
    const avgAchiev = achievCount > 0 ? Math.round(totalAchiev / achievCount) : 0;

    const raidCount = raidBuckets.Mythic + raidBuckets.Heroic + raidBuckets.Normal;

    return {
      classDistribution,
      maxClassCount,
      activeCount,
      inactiveCount,
      avgIlvl,
      avgMplus,
      avgAchiev,
      ilvlBuckets,
      mplusBuckets,
      raidBuckets,
      ilvlCount,
      mplusCount,
      raidCount,
      maxIlvlBucket: Math.max(...Object.values(ilvlBuckets)),
      maxMplusBucket: Math.max(...Object.values(mplusBuckets)),
      maxRaidBucket: Math.max(...Object.values(raidBuckets)),
    };
  }, [members]);

  const total = members.length;
  const activePct = total > 0 ? Math.round((stats.activeCount / total) * 100) : 0;

  const ilvlColors: Record<string, string> = {
    "650+": "#c084fc",
    "620-649": "#60a5fa",
    "590-619": "#4ade80",
    "560-589": "#facc15",
    "<560": "#6b7280",
  };

  const mplusColors: Record<string, string> = {
    "3000+": "#c084fc",
    "2500-2999": "#fb923c",
    "2000-2499": "#60a5fa",
    "1500-1999": "#4ade80",
    "1-1499": "#6b7280",
  };

  const raidColors: Record<string, string> = {
    Mythic: "#c084fc",
    Heroic: "#fb923c",
    Normal: "#4ade80",
  };

  return (
    <div className="space-y-6">
      {/* Top row: Averages + Activity */}
      <div className="glass rounded-3xl p-6 border border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
          {/* Guild Averages */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-3xl font-mono tabular-nums font-bold ${getItemLevelColor(stats.avgIlvl)}`}>
                {stats.avgIlvl}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("avgIlvl")}</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-mono tabular-nums font-bold ${getMythicPlusColor(stats.avgMplus)}`}>
                {stats.avgMplus}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("avgMplus")}</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-mono tabular-nums font-bold ${getAchievementColor(stats.avgAchiev)}`}>
                {stats.avgAchiev.toLocaleString()}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("avgAchievements")}</div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-12 bg-white/5" />

          {/* Activity */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-mono tabular-nums font-bold text-green-400">
                {stats.activeCount}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("active")}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-mono tabular-nums font-bold text-gray-500">
                {stats.inactiveCount}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("inactive")}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-mono tabular-nums font-bold text-white">
                {activePct}%
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1">{t("activeRate")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Class Distribution */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
            {t("classDistribution")}
          </h3>
          <div className="space-y-2.5">
            {stats.classDistribution.map(([cls, count]) => (
              <Bar
                key={cls}
                value={count}
                max={stats.maxClassCount}
                color={CLASS_COLORS[cls] ?? "#6b7280"}
                label={cls}
                count={count}
              />
            ))}
          </div>
        </div>

        {/* Item Level Distribution */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
            {t("ilvlDistribution")}
          </h3>
          <div className="space-y-2.5">
            {Object.entries(stats.ilvlBuckets).map(([bucket, count]) => (
              <Bar
                key={bucket}
                value={count}
                max={stats.maxIlvlBucket}
                color={ilvlColors[bucket]!}
                label={bucket}
                count={count}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            {t("basedOn", { count: stats.ilvlCount, total })}
          </p>
        </div>

        {/* M+ Score Distribution */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
            {t("mplusDistribution")}
          </h3>
          <div className="space-y-2.5">
            {Object.entries(stats.mplusBuckets).map(([bucket, count]) => (
              <Bar
                key={bucket}
                value={count}
                max={stats.maxMplusBucket}
                color={mplusColors[bucket]!}
                label={bucket}
                count={count}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            {t("basedOn", { count: stats.mplusCount, total })}
          </p>
        </div>

        {/* Raid Progress */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
            {t("raidProgress")}
          </h3>
          <div className="space-y-2.5">
            {Object.entries(stats.raidBuckets).map(([tier, count]) => (
              <Bar
                key={tier}
                value={count}
                max={stats.maxRaidBucket}
                color={raidColors[tier]!}
                label={tier}
                count={count}
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            {t("basedOn", { count: stats.raidCount, total })}
          </p>
        </div>
      </div>
    </div>
  );
}
