"use client";

import { CLASS_COLORS } from "@wow/database/constants";
import type { LeaderboardCategory } from "@/lib/leaderboard";

const MEDAL_STYLES = [
  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", // gold
  "bg-zinc-400/15 text-zinc-300 border-zinc-400/30", // silver
  "bg-amber-700/20 text-amber-500 border-amber-700/30", // bronze
];

export function LeaderboardCard({
  category,
  translatedName,
  showGuild,
}: {
  category: LeaderboardCategory;
  translatedName: string;
  showGuild?: boolean;
}) {
  return (
    <div
      className="bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{category.icon}</span>
        <h3 className="text-sm font-bold tracking-tight">{translatedName}</h3>
      </div>

      <div className="space-y-2.5">
        {category.entries.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${MEDAL_STYLES[i]}`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{
                  color:
                    (entry.characterClass &&
                      CLASS_COLORS[entry.characterClass]) ||
                    "var(--text)",
                }}
              >
                {entry.name}
              </p>
              {showGuild && entry.guildName && (
                <p className="text-[10px] text-[var(--text-secondary)] truncate">
                  {entry.guildName}
                </p>
              )}
            </div>
            <span
              className={`text-xs font-mono font-bold tabular-nums ${entry.colorClass}`}
            >
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
