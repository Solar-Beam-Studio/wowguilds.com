"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Sidebar } from "@/components/sidebar";
import { LeaderboardGrid } from "@/components/leaderboard-grid";
import { Search, Zap, Trophy, ShieldCheck, Loader2 } from "lucide-react";
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

interface HomeClientProps {
  guilds: Guild[];
  totalMembers: number;
  activeMembers: number;
  leaderboardCategories: LeaderboardCategory[];
}

export function HomeClient({ guilds, totalMembers, activeMembers, leaderboardCategories }: HomeClientProps) {
  const t = useTranslations("home");
  const router = useRouter();

  // Lookup form state
  const [guildName, setGuildName] = useState("");
  const [realm, setRealm] = useState("");
  const [region, setRegion] = useState("eu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const spotlightCategories = useMemo(() => {
    return leaderboardCategories.filter(c => ["itemLevel", "mythicPlus", "raids"].includes(c.id));
  }, [leaderboardCategories]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!guildName.trim() || !realm.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guildName.trim(),
          realm: realm.trim().toLowerCase(),
          region,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      const guild = await res.json();
      router.push(`/g/${guild.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-1.5 flex flex-col md:flex-row gap-1.5 overflow-hidden max-h-screen">
      <Sidebar />

      <main className="grow bg-[var(--bg-secondary)] rounded-2xl overflow-y-auto relative scroll-smooth flex flex-col">
        {/* App Header */}
        <header className="sticky top-0 z-30 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-3 md:px-8 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-display font-black tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent fill-current" />
              {t("heading").toUpperCase()}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {guilds.length} {t("verifiedGuilds")} · {totalMembers.toLocaleString()} {t("members")}
              </span>
              <span className="text-[10px] text-[var(--border)]">|</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {activeMembers.toLocaleString()} {t("activePlayers")}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8 space-y-10">
          {/* Guild Lookup Form */}
          <section>
            <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 block">
                  {t("guildNamePlaceholder")}
                </label>
                <input
                  type="text"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  placeholder="Pool Party"
                  className="w-full h-11 px-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium"
                  required
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 block">
                  {t("realmPlaceholder")}
                </label>
                <input
                  type="text"
                  value={realm}
                  onChange={(e) => setRealm(e.target.value)}
                  placeholder="archimonde"
                  className="w-full h-11 px-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium"
                  required
                />
              </div>
              <div className="w-full sm:w-32">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1 block">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full h-11 px-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium"
                >
                  <option value="eu">EU</option>
                  <option value="us">US</option>
                  <option value="kr">KR</option>
                  <option value="tw">TW</option>
                  <option value="cn">CN</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-11 px-6 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-lg shadow-accent/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t("searchButton")}
              </button>
            </form>
            {error && (
              <p className="text-red-500 text-xs font-medium mt-2">{error}</p>
            )}
          </section>

          {/* Featured Spotlight: The Elite */}
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
                      <h3 className="text-xs font-bold uppercase tracking-wider">{t(`topRanks`)}: {cat.id}</h3>
                    </div>
                    <div className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[8px] font-black uppercase tracking-widest border border-accent/20">
                      World Rank
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Recent Guilds (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t("recentGuilds")}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guilds.length === 0 ? (
                  <div className="col-span-full bg-[var(--bg-tertiary)] rounded-2xl p-12 text-center border-2 border-dashed border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] font-medium">{t("noGuildsYet")}</p>
                  </div>
                ) : (
                  guilds.slice(0, 8).map((guild) => (
                    <Link
                      key={guild.id}
                      href={`/g/${guild.id}`}
                      className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] border border-[var(--border)] transition-all rounded-2xl group hover:border-accent hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-accent font-black text-base border border-[var(--border)] group-hover:bg-accent group-hover:text-white transition-all">
                          {guild.name[0]}
                        </div>
                        <div>
                          <h3 className="text-sm font-display font-bold leading-tight group-hover:text-accent transition-colors">{guild.name}</h3>
                          <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-0.5">
                            {guild.realm} — {guild.region.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono">{guild.memberCount}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase opacity-50">{t("members")}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Right: More Ranks (1/3) */}
            <div className="space-y-6">
              <div className="px-1">
                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">Regional Tiers</h2>
              </div>
              <div className="space-y-3">
                {leaderboardCategories.filter(c => !["itemLevel", "mythicPlus", "raids"].includes(c.id)).slice(0, 4).map(cat => (
                  <div key={cat.id} className="p-4 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-base">{cat.icon}</span>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">{cat.id}</h4>
                    </div>
                    <div className="space-y-2">
                       {cat.entries.slice(0, 2).map((entry, i) => (
                         <div key={entry.name} className="flex items-center justify-between">
                           <div className="flex items-center gap-2 min-w-0">
                             <span className="text-[9px] font-bold text-[var(--text-secondary)] w-3">{i+1}</span>
                             <p className="text-xs font-bold truncate" style={{ color: (entry.characterClass && CLASS_COLORS[entry.characterClass]) || 'var(--text)' }}>{entry.name}</p>
                           </div>
                           <span className="text-[10px] font-mono font-bold text-accent">{entry.value}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hall of Fame: Full Grid */}
          <section className="pt-8 border-t border-[var(--border)]">
             <div className="px-1 mb-6">
                <h2 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t("topRanks")} Detailed</h2>
             </div>
             <LeaderboardGrid categories={leaderboardCategories} showGuild />
          </section>
        </div>
      </main>
    </div>
  );
}
