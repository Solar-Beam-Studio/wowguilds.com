"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/sidebar";
import { ActivitySidebar } from "@/components/activity-sidebar";
import { GuildSearch } from "@/components/guild-search";
import { LeaderboardGrid } from "@/components/leaderboard-grid";
import { Trophy, ShieldCheck, Users, Activity, Eye } from "lucide-react";
import type { LeaderboardCategory } from "@/lib/leaderboard";
import { CLASS_COLORS } from "@wow/database/constants";

interface Guild {
  id: string;
  name: string;
  realm: string;
  region: string;
  memberCount: number;
  lastActiveSyncAt: Date | null;
}

interface ActivityItem {
  id: string;
  type: string;
  totalItems: number;
  processedItems: number;
  completedAt: string | null;
  duration: number | null;
  guildName: string;
  guildId: string;
  guildRealm: string;
  guildRegion: string;
}

interface HomeClientProps {
  guilds: Guild[];
  totalMembers: number;
  activeMembers: number;
  leaderboardCategories: LeaderboardCategory[];
  recentActivity: ActivityItem[];
}

export function HomeClient({ guilds, totalMembers, activeMembers, leaderboardCategories, recentActivity }: HomeClientProps) {
  const t = useTranslations("home");

  const spotlightCategories = useMemo(() => {
    return leaderboardCategories.filter(c => ["itemLevel", "mythicPlus", "raids"].includes(c.id));
  }, [leaderboardCategories]);

  return (
    <div className="min-h-screen bg-[var(--bg)] p-1.5 flex flex-col md:flex-row gap-1.5 overflow-hidden max-h-screen">
      <Sidebar />

      <main className="grow bg-[var(--bg-secondary)] rounded-2xl overflow-y-auto relative scroll-smooth flex flex-col min-w-0">
        {/* Compact stat bar */}
        <header className="sticky top-0 z-30 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-2.5 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            <span>{guilds.length} {t("verifiedGuilds")}</span>
            <span className="text-[var(--border)]">/</span>
            <span>{totalMembers.toLocaleString()} {t("characters")}</span>
            <span className="text-[var(--border)]">/</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>{activeMembers.toLocaleString()} {t("activePlayers")}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8 space-y-10">
          {/* Hero: Google-style centered search */}
          <section className="flex flex-col items-center justify-center py-8 md:py-14 text-center">
            <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-tight">
              {t("tagline")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed max-w-md">
              {t("subtitle")}
            </p>

            <GuildSearch />

            {/* Value props */}
            <div className="flex flex-wrap justify-center gap-5 mt-6">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                <Eye className="w-3.5 h-3.5 text-accent" />
                {t("valueProp1")}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                <Activity className="w-3.5 h-3.5 text-accent" />
                {t("valueProp2")}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                <Users className="w-3.5 h-3.5 text-accent" />
                {t("valueProp3")}
              </div>
            </div>
          </section>

          {/* Top Ranks Spotlight */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-2">
                <Trophy className="w-3 h-3 text-amber-500" />
                {t("topRanks")}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {spotlightCategories.map((cat) => (
                <div key={cat.id} className="relative group overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl p-5 hover:border-accent/50 transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.icon}</span>
                      <h3 className="text-xs font-bold uppercase tracking-wider">{cat.id === 'itemLevel' ? 'iLvl' : cat.id === 'mythicPlus' ? 'M+' : 'Raids'}</h3>
                    </div>
                  </div>

                  {cat.entries.slice(0, 1).map((entry) => (
                    <div key={entry.name} className="flex flex-col gap-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-black tracking-tight leading-none" style={{ color: (entry.characterClass && CLASS_COLORS[entry.characterClass]) || 'var(--text)' }}>
                          {entry.value}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-widest">{cat.id === 'itemLevel' ? 'iLvl' : cat.id === 'mythicPlus' ? 'Score' : 'Progress'}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-accent border border-[var(--border)] font-black text-lg">
                          {entry.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-lg truncate leading-none mb-1" style={{ color: (entry.characterClass && CLASS_COLORS[entry.characterClass]) || 'var(--text)' }}>
                            {entry.name}
                          </p>
                          <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider truncate">
                            {entry.guildName}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                     <ShieldCheck className="w-32 h-32" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Hall of Fame: Full Grid */}
          <section className="pt-8 border-t border-[var(--border)]">
             <div className="px-1 mb-6">
                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t("topRanks")} Detailed</h2>
             </div>
             <LeaderboardGrid categories={leaderboardCategories} showGuild />
          </section>
        </div>
      </main>

      <ActivitySidebar seed={recentActivity} />
    </div>
  );
}
