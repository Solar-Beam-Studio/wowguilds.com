"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { DataTable, type Column } from "@/components/data-table";
import { Zap, Trophy, Activity, Users, ArrowRight, BarChart3, Globe2, Plus, Search, ShieldCheck, Timer } from "lucide-react";
import { CLASS_COLORS, getItemLevelColor, getMythicPlusColor } from "@wow/database/constants";
import { formatDistanceToNow } from "date-fns";

interface Guild {
  id: string;
  name: string;
  realm: string;
  region: string;
  memberCount: number;
  lastActiveSyncAt: Date | null;
}

interface TopCharacter {
  characterName: string;
  realm: string;
  characterClass: string | null;
  itemLevel: number | null;
  mythicPlusScore: number | null;
  guild: { name: string; id: string };
}

interface SyncLog {
  id: number;
  guildId: string;
  timestamp: Date;
  status: string;
  message: string | null;
  characterName: string | null;
  guild: { name: string };
}

interface HomeClientProps {
  guilds: Guild[];
  totalMembers: number;
  activeMembers: number;
  topCharacters: TopCharacter[];
  recentLogs: SyncLog[];
}

export function HomeClient({ guilds, totalMembers, activeMembers, topCharacters, recentLogs }: HomeClientProps) {
  const [search, setSearch] = useState("");

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

  const filteredCharacters = useMemo(() => {
    if (!search) return topCharacters;
    const q = search.toLowerCase();
    return topCharacters.filter(
      (c) =>
        c.characterName.toLowerCase().includes(q) ||
        c.realm.toLowerCase().includes(q) ||
        c.characterClass?.toLowerCase().includes(q) ||
        c.guild.name.toLowerCase().includes(q)
    );
  }, [topCharacters, search]);

  const topCharacterColumns: Column<TopCharacter>[] = [
    {
      key: "characterName",
      label: "Character",
      sortValue: (c) => c.characterName.toLowerCase(),
      render: (c) => (
        <>
          <span
            className="text-sm font-bold"
            style={{ color: (c.characterClass && CLASS_COLORS[c.characterClass]) || undefined }}
          >
            {c.characterName}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 ml-2">{c.realm}</span>
        </>
      ),
    },
    {
      key: "guild",
      label: "Guild",
      render: (c) => (
        <Link
          href={`/g/${c.guild.id}`}
          className="text-xs text-[var(--text-secondary)] hover:text-accent font-bold transition-colors"
        >
          {c.guild.name}
        </Link>
      ),
    },
    {
      key: "itemLevel",
      label: "iLvl",
      align: "right",
      sortValue: (c) => c.itemLevel ?? 0,
      render: (c) =>
        c.itemLevel ? (
          <span className="font-mono font-bold" style={{ color: getItemLevelColor(c.itemLevel) }}>
            {Math.round(c.itemLevel)}
          </span>
        ) : <span>-</span>,
    },
    {
      key: "mythicPlusScore",
      label: "M+",
      align: "right",
      sortValue: (c) => c.mythicPlusScore ?? 0,
      render: (c) =>
        c.mythicPlusScore ? (
          <span className="font-mono font-bold" style={{ color: getMythicPlusColor(c.mythicPlusScore) }}>
            {Math.round(c.mythicPlusScore)}
          </span>
        ) : <span>-</span>,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] p-1.5 flex flex-col md:flex-row gap-1.5 overflow-hidden max-h-screen">
      <Sidebar />

      <main className="grow bg-[var(--bg-secondary)] rounded-2xl overflow-y-auto relative scroll-smooth">
        {/* Global Search & Stats Header */}
        <div className="p-4 md:p-6 lg:p-8 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight mb-2">Global Network</h1>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Real-time sync across {guilds.length} guilds and {totalMembers} characters.</p>
            </div>
            
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guilds, characters or realms..."
                className="w-full h-12 pl-12 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* New Dashboard Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-accent to-accent-hover rounded-[2rem] p-8 text-white shadow-2xl shadow-accent/20">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/10 backdrop-blur-sm">
                  <Activity className="w-3 h-3" /> Live Data Stream
                </div>
                <h2 className="text-4xl font-display font-black tracking-tight mb-4 leading-tight">
                  The Sync Engine for <br/>Modern Guilds.
                </h2>
                <p className="text-lg text-white/80 mb-8 font-medium max-w-xl">
                  Automated performance tracking, roster management, and activity insights for World of Warcraft guilds.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/signup" className="h-11 px-6 bg-white text-accent rounded-xl font-bold hover:bg-white/90 transition-all shadow-lg flex items-center gap-2">
                    Start Syncing <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/login" className="h-11 px-6 bg-white/10 text-white rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all backdrop-blur-md">
                    Member Login
                  </Link>
                </div>
              </div>
              <div className="absolute right-[-5%] top-[-10%] opacity-10 pointer-events-none rotate-12">
                <BarChart3 className="w-64 h-64" />
              </div>
            </div>

            {/* Global Stats Cards */}
            <div className="space-y-4">
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Active Players</p>
                    <p className="text-2xl font-display font-bold">{activeMembers.toLocaleString()}</p>
                  </div>
               </div>
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Verified Guilds</p>
                    <p className="text-2xl font-display font-bold">{guilds.length}</p>
                  </div>
               </div>
               <div className="bg-[var(--bg-tertiary)] p-6 rounded-[1.5rem] border border-[var(--border)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Live Syncs</p>
                    <p className="text-2xl font-display font-bold">24/7</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Guilds List - 2/3 width on XL */}
            <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">Connected Guilds</h2>
                <Link href="/guilds/new" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Your Guild
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredGuilds.length === 0 ? (
                  <div className="md:col-span-2 bg-[var(--bg-tertiary)] rounded-2xl p-12 text-center border-2 border-dashed border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] font-medium">{search ? "No guilds match your search." : "No guilds tracked yet."}</p>
                  </div>
                ) : (
                  filteredGuilds.slice(0, 10).map((guild) => (
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
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase opacity-50">Members</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Sidebar Data: Activity & Top Stats */}
            <div className="space-y-8">
              {/* Recent Activity Feed */}
              <div>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">Recent Activity</h2>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-500 uppercase">Live</span>
                  </div>
                </div>
                <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-3xl overflow-hidden p-2 space-y-1">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)]/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{log.guild.name}</span>
                        <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[var(--text-secondary)] leading-snug">
                        {log.message || `Synced character ${log.characterName}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini Top Performers */}
              <div>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">Top Ranks</h2>
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-sm">
                  <DataTable
                    columns={topCharacterColumns}
                    data={filteredCharacters.slice(0, 5)}
                    rowKey={(c) => `${c.characterName}-${c.realm}`}
                    defaultSortKey="itemLevel"
                    defaultSortDirection="desc"
                    maxHeight="none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="mt-12 py-12 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <span className="text-xs font-bold tracking-[0.2em] uppercase">WoW Guild Sync</span>
            </div>
            <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.1em]">
              <span>© 2025 Solar Beam</span>
              <a href="https://raider.io" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Data by Raider.IO & Blizzard</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



