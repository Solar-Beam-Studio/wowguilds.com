"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search } from "lucide-react";
import { MemberTable } from "@/components/member-table";
import { LeaderboardGrid } from "@/components/leaderboard-grid";
import { buildCategories } from "@/lib/leaderboard";
import type { GuildMember } from "@/hooks/use-members";

export function PublicGuildClient({
  members,
  region,
}: {
  members: GuildMember[];
  region: string;
}) {
  const [tab, setTab] = useState<"leaderboard" | "roster">("leaderboard");
  const [search, setSearch] = useState("");
  const t = useTranslations("guildDetail");
  const locale = useLocale();

  const categories = useMemo(
    () => buildCategories(members, locale),
    [members, locale]
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-6 border-b border-[var(--border)] mb-6">
        <button
          onClick={() => setTab("leaderboard")}
          className={`pb-2.5 text-sm font-bold transition-colors ${
            tab === "leaderboard"
              ? "border-b-2 border-accent text-[var(--text)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          {t("tabLeaderboard")}
        </button>
        <button
          onClick={() => setTab("roster")}
          className={`pb-2.5 text-sm font-bold transition-colors ${
            tab === "roster"
              ? "border-b-2 border-accent text-[var(--text)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          {t("tabRoster")}
        </button>
      </div>

      {tab === "leaderboard" && <LeaderboardGrid categories={categories} />}

      {tab === "roster" && (
        <div>
          <div className="mb-5 relative max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full h-10 pl-11 pr-4 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
            />
          </div>
          <MemberTable members={members} region={region} search={search} />
        </div>
      )}
    </div>
  );
}
