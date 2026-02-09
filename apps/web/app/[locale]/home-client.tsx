"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sidebar } from "@/components/sidebar";
import { LeaderboardGrid } from "@/components/leaderboard-grid";
import { Activity, Users, ArrowRight, Plus, Search, ShieldCheck, Timer } from "lucide-react";
import type { LeaderboardCategory } from "@/lib/leaderboard";

interface Guild {
  id: string;
  name: string;
  realm: string;
  region: string;
  memberCount: number;
  lastActiveSyncAt: Date | null;
}

interface HomeClientProps {
  guilds: Guild[];
  totalMembers: number;
  activeMembers: number;
  leaderboardCategories: LeaderboardCategory[];
}

export function HomeClient({ guilds, totalMembers, activeMembers, leaderboardCategories }: HomeClientProps) {
  const [search, setSearch] = useState("");
  const t = useTranslations("home");

  const filteredGuilds = useMemo(() => {
    if (!search) return guilds;
    const q = search.toLowerCase();
    return guilds.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.realm.toLowerCase().includes(q) ||
        g.region.toLowerCase().includes(q)
    );
  }, [guilds, search]);

  return (
    <div className="min-h-screen bg-[var(--bg)] p-1.5 flex flex-col md:flex-row gap-1.5 overflow-hidden max-h-screen">
      <Sidebar />

      <main className="grow bg-[var(--bg-secondary)] rounded-2xl overflow-y-auto relative scroll-smooth">
        {/* Global Search & Stats Header */}
        <div className="p-4 md:p-6 lg:p-8 space-y-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight mb-2">{t("heading")}</h1>
              <p className="text-sm text-[var(--text-secondary)] font-medium">{t("subtitle", { guildCount: guilds.length, memberCount: totalMembers })}</p>
            </div>

            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full h-12 pl-12 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* New Dashboard Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] p-8 text-white shadow-2xl shadow-accent/20 bg-accent/80 backdrop-blur-sm">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/10 backdrop-blur-sm">
                  <Activity className="w-3 h-3" /> {t("liveDataStream")}
                </div>
                <h2 className="text-4xl font-display font-black tracking-tight mb-4 leading-tight">
                  {t("heroTitle")}
                </h2>
                <p className="text-lg text-white/80 mb-8 font-medium max-w-xl">
                  {t("heroDescription")}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/signup" className="h-11 px-6 bg-white text-accent rounded-xl font-bold hover:bg-white/90 transition-all shadow-lg flex items-center gap-2">
                    {t("startSyncing")} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/login" className="h-11 px-6 bg-white/10 text-white rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all backdrop-blur-md flex items-center">
                    {t("memberLogin")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Global Stats Cards */}
            <div className="space-y-4">
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">{t("activePlayers")}</p>
                    <p className="text-2xl font-display font-bold">{activeMembers.toLocaleString()}</p>
                  </div>
               </div>
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">{t("verifiedGuilds")}</p>
                    <p className="text-2xl font-display font-bold">{guilds.length}</p>
                  </div>
               </div>
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">{t("liveSyncs")}</p>
                    <p className="text-2xl font-display font-bold">24/7</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Guilds List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t("connectedGuilds")}</h2>
              <Link href="/guilds/new" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> {t("addYourGuild")}
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredGuilds.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3 bg-[var(--bg-tertiary)] rounded-2xl p-12 text-center border-2 border-dashed border-[var(--border)]">
                  <p className="text-sm text-[var(--text-secondary)] font-medium">{search ? t("noGuildsMatch") : t("noGuildsYet")}</p>
                </div>
              ) : (
                filteredGuilds.slice(0, 12).map((guild) => (
                  <Link
                    key={guild.id}
                    href={`/g/${guild.id}`}
                    className="flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)] bg-[var(--bg-secondary)] border border-[var(--border)] transition-all rounded-2xl group hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-accent font-black text-lg border border-[var(--border)] group-hover:bg-accent group-hover:text-white transition-colors">
                        {guild.name[0]}
                      </div>
                      <div>
                        <h3 className="font-display font-bold leading-tight group-hover:text-accent transition-colors">{guild.name}</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-1">
                          {guild.realm} — {guild.region.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{guild.memberCount}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase opacity-50">{t("members")}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Global Leaderboard */}
          <div className="space-y-6">
            <div className="px-2">
              <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t("topRanks")}</h2>
            </div>
            <LeaderboardGrid categories={leaderboardCategories} showGuild />
          </div>
        </div>
      </main>
    </div>
  );
}
