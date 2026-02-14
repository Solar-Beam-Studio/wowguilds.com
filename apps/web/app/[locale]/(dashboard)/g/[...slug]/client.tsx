"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { MemberTable } from "@/components/member-table";
import { LeaderboardGrid } from "@/components/leaderboard-grid";
import { buildCategories } from "@/lib/leaderboard";
import { ActivityFeed } from "./activity-feed";
import type { GuildMember } from "@/hooks/use-members";

type Tab = "leaderboard" | "roster" | "activity";

function getTabFromHash(): Tab {
  if (typeof window === "undefined") return "leaderboard";
  const hash = window.location.hash;
  if (hash === "#roster") return "roster";
  if (hash === "#activity") return "activity";
  return "leaderboard";
}

export function PublicGuildClient({
  members,
  region,
  guildId,
}: {
  members: GuildMember[];
  region: string;
  guildId: string;
}) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [search, setSearch] = useState("");
  const t = useTranslations("guildDetail");
  const locale = useLocale();

  // Sync tab with URL hash
  useEffect(() => {
    setTab(getTabFromHash());
    const onHashChange = () => setTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function switchTab(newTab: Tab) {
    setTab(newTab);
    window.history.replaceState(null, "", newTab === "leaderboard" ? " " : `#${newTab}`);
  }

  const categories = useMemo(
    () => buildCategories(members, locale),
    [members, locale]
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-10 border-b border-white/5 mb-8">
        <button
          onClick={() => switchTab("leaderboard")}
          className={`pb-4 text-sm uppercase transition-colors ${
            tab === "leaderboard"
              ? "font-black tracking-[0.2em] border-b-2 border-violet-500 text-white"
              : "font-bold tracking-wider text-gray-600 hover:text-gray-300"
          }`}
        >
          {t("tabLeaderboard")}
        </button>
        <button
          onClick={() => switchTab("roster")}
          className={`pb-4 text-sm uppercase transition-colors ${
            tab === "roster"
              ? "font-black tracking-[0.2em] border-b-2 border-violet-500 text-white"
              : "font-bold tracking-wider text-gray-600 hover:text-gray-300"
          }`}
        >
          {t("tabRoster")}
        </button>
        <button
          onClick={() => switchTab("activity")}
          className={`pb-4 text-sm uppercase transition-colors ${
            tab === "activity"
              ? "font-black tracking-[0.2em] border-b-2 border-violet-500 text-white"
              : "font-bold tracking-wider text-gray-600 hover:text-gray-300"
          }`}
        >
          {t("tabActivity")}
        </button>
      </div>

      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-400">{t("firstSync")}</p>
        </div>
      )}

      {members.length > 0 && tab === "leaderboard" && <LeaderboardGrid categories={categories} />}

      {members.length > 0 && tab === "roster" && (
        <div>
          <div className="mb-5 relative max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full h-10 pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 placeholder:text-gray-600"
            />
          </div>
          <MemberTable members={members} region={region} search={search} />
        </div>
      )}

      {members.length > 0 && tab === "activity" && <ActivityFeed guildId={guildId} />}
    </div>
  );
}
