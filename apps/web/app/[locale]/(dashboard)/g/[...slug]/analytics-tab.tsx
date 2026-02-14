"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CLASS_COLORS,
  getItemLevelColor,
  getMythicPlusColor,
  getAchievementColor,
} from "@wow/database";
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
    // Class distribution
    const classCounts: Record<string, number> = {};
    let totalIlvl = 0;
    let ilvlCount = 0;
    let totalMplus = 0;
    let mplusCount = 0;
    let totalAchiev = 0;
    let achievCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    // iLvl buckets
    const ilvlBuckets = { "650+": 0, "620-649": 0, "590-619": 0, "560-589": 0, "<560": 0 };
    // M+ buckets
    const mplusBuckets = { "3000+": 0, "2500-2999": 0, "2000-2499": 0, "1500-1999": 0, "1-1499": 0, "None": 0 };
    // Raid buckets
    const raidBuckets = { Mythic: 0, Heroic: 0, Normal: 0, None: 0 };

    for (const m of members) {
      // Class
      if (m.characterClass) {
        classCounts[m.characterClass] = (classCounts[m.characterClass] || 0) + 1;
      }

      // Averages
      if (m.itemLevel && m.itemLevel > 0) {
        totalIlvl += m.itemLevel;
        ilvlCount++;
      }
      if (m.mythicPlusScore && m.mythicPlusScore > 0) {
        totalMplus += m.mythicPlusScore;
        mplusCount++;
      }
      if (m.achievementPoints > 0) {
        totalAchiev += m.achievementPoints;
        achievCount++;
      }

      // Activity
      if (m.activityStatus === "active") activeCount++;
      else inactiveCount++;

      // iLvl distribution
      const ilvl = m.itemLevel ?? 0;
      if (ilvl >= 650) ilvlBuckets["650+"]++;
      else if (ilvl >= 620) ilvlBuckets["620-649"]++;
      else if (ilvl >= 590) ilvlBuckets["590-619"]++;
      else if (ilvl >= 560) ilvlBuckets["560-589"]++;
      else ilvlBuckets["<560"]++;

      // M+ distribution
      const mplus = m.mythicPlusScore ?? 0;
      if (mplus >= 3000) mplusBuckets["3000+"]++;
      else if (mplus >= 2500) mplusBuckets["2500-2999"]++;
      else if (mplus >= 2000) mplusBuckets["2000-2499"]++;
      else if (mplus >= 1500) mplusBuckets["1500-1999"]++;
      else if (mplus >= 1) mplusBuckets["1-1499"]++;
      else mplusBuckets["None"]++;

      // Raid progress
      const rp = m.raidProgress ?? "";
      if (/mythic/i.test(rp)) raidBuckets.Mythic++;
      else if (/heroic/i.test(rp)) raidBuckets.Heroic++;
      else if (/normal/i.test(rp)) raidBuckets.Normal++;
      else raidBuckets.None++;
    }

    // Sort classes by count desc
    const classDistribution = Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1]);
    const maxClassCount = classDistribution[0]?.[1] ?? 0;

    const avgIlvl = ilvlCount > 0 ? Math.round(totalIlvl / ilvlCount) : 0;
    const avgMplus = mplusCount > 0 ? Math.round(totalMplus / mplusCount) : 0;
    const avgAchiev = achievCount > 0 ? Math.round(totalAchiev / achievCount) : 0;

    const maxIlvlBucket = Math.max(...Object.values(ilvlBuckets));
    const maxMplusBucket = Math.max(...Object.values(mplusBuckets));
    const maxRaidBucket = Math.max(...Object.values(raidBuckets));

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
      maxIlvlBucket,
      maxMplusBucket,
      maxRaidBucket,
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
    "None": "#374151",
  };

  const raidColors: Record<string, string> = {
    Mythic: "#c084fc",
    Heroic: "#fb923c",
    Normal: "#4ade80",
    None: "#374151",
  };

  return (
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

      {/* Activity Status */}
      <div className="glass rounded-3xl p-6 border border-white/5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
          {t("activityStatus")}
        </h3>
        <div className="flex items-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-mono tabular-nums font-bold text-green-400">
              {stats.activeCount}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("active")}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono tabular-nums font-bold text-gray-500">
              {stats.inactiveCount}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("inactive")}</div>
          </div>
          <div className="text-center ml-auto">
            <div className="text-3xl font-mono tabular-nums font-bold text-white">
              {activePct}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("activeRate")}</div>
          </div>
        </div>
        {/* Stacked bar */}
        <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
          <div
            className="h-full bg-green-400 transition-all duration-500"
            style={{ width: `${activePct}%` }}
          />
          <div
            className="h-full bg-gray-600 transition-all duration-500"
            style={{ width: `${100 - activePct}%` }}
          />
        </div>
      </div>

      {/* Guild Averages */}
      <div className="glass rounded-3xl p-6 border border-white/5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5">
          {t("guildAverages")}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div
              className={`text-3xl font-mono tabular-nums font-bold ${getItemLevelColor(stats.avgIlvl)}`}
            >
              {stats.avgIlvl}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("avgIlvl")}</div>
          </div>
          <div className="text-center">
            <div
              className={`text-3xl font-mono tabular-nums font-bold ${getMythicPlusColor(stats.avgMplus)}`}
            >
              {stats.avgMplus}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("avgMplus")}</div>
          </div>
          <div className="text-center">
            <div
              className={`text-3xl font-mono tabular-nums font-bold ${getAchievementColor(stats.avgAchiev)}`}
            >
              {stats.avgAchiev.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("avgAchievements")}</div>
          </div>
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
              label={bucket === "None" ? t("none") : bucket}
              count={count}
            />
          ))}
        </div>
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
              label={tier === "None" ? t("none") : tier}
              count={count}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
