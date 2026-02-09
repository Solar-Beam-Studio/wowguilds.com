"use client";

import { useTranslations } from "next-intl";
import { LeaderboardCard } from "@/components/leaderboard-card";
import type { LeaderboardCategory } from "@/lib/leaderboard";

export function LeaderboardGrid({
  categories,
  showGuild,
}: {
  categories: LeaderboardCategory[];
  showGuild?: boolean;
}) {
  const t = useTranslations("hallOfFame");
  const visible = categories.filter((c) => c.entries.length > 0);

  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {visible.map((cat) => (
        <LeaderboardCard
          key={cat.id}
          category={cat}
          translatedName={t(cat.id)}
          showGuild={showGuild}
        />
      ))}
    </div>
  );
}
