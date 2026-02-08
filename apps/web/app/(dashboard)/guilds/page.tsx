"use client";

import Link from "next/link";
import { useGuilds, useDeleteGuild, useToggleSync } from "@/hooks/use-guilds";
import { Plus, Trash2, ShieldCheck, Activity, Users, ExternalLink, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function GuildsPage() {
  const { data: guilds, isLoading } = useGuilds();
  const deleteGuild = useDeleteGuild();
  const toggleSync = useToggleSync();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const syncingCount = guilds?.filter(g => g.syncEnabled).length || 0;
  const totalMembers = guilds?.reduce((acc, g) => acc + (g._count?.members || g.memberCount || 0), 0) || 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section matching Home style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight mb-2">My Guilds</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Manage your connected World of Warcraft guilds and synchronization settings.</p>
        </div>
        
        <Link href="/guilds/new" className="h-11 px-6 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> Add New Guild
        </Link>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-tertiary)] p-6 rounded-3xl border border-[var(--border)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Total Guilds</p>
            <p className="text-2xl font-display font-bold">{guilds?.length || 0}</p>
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)] p-6 rounded-3xl border border-[var(--border)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Syncing Active</p>
            <p className="text-2xl font-display font-bold">{syncingCount}</p>
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)] p-6 rounded-3xl border border-[var(--border)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-0.5">Managed Members</p>
            <p className="text-2xl font-display font-bold">{totalMembers.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Guild Grid */}
      {!guilds || guilds.length === 0 ? (
        <div className="bg-[var(--bg-tertiary)] rounded-[2rem] p-12 text-center border-2 border-dashed border-[var(--border)] flex flex-col items-center gap-4 mt-8">
          <div className="w-16 h-16 rounded-3xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--border)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-xl font-display font-bold mb-2">No Guilds Connected</h3>
            <p className="text-sm text-[var(--text-secondary)] font-medium mb-6">Start by adding your first guild to begin synchronizing data from Blizzard and Raider.IO.</p>
            <Link href="/guilds/new" className="h-11 px-6 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 flex items-center gap-2 justify-center">
              <Plus className="w-4 h-4" /> Add Your First Guild
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guilds.map((guild) => (
            <div
              key={guild.id}
              className="group bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[2rem] p-6 transition-all hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1 relative flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-accent font-black text-2xl border border-[var(--border)] group-hover:bg-accent group-hover:text-white transition-all shadow-inner">
                    {guild.name[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black tracking-tight group-hover:text-accent transition-colors leading-tight">{guild.name}</h2>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-1">
                      {guild.realm} — {guild.region.toUpperCase()}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() =>
                    toggleSync.mutate({
                      guildId: guild.id,
                      syncEnabled: !guild.syncEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    guild.syncEnabled ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]" : "bg-[var(--bg-tertiary)]"
                  }`}
                  role="switch"
                  aria-checked={guild.syncEnabled}
                  title={guild.syncEnabled ? "Syncing enabled" : "Syncing disabled"}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      guild.syncEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-[var(--bg-tertiary)] p-3 rounded-2xl border border-[var(--border)]/50">
                  <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Members</p>
                  <p className="text-lg font-display font-bold">{guild._count?.members ?? guild.memberCount}</p>
                </div>
                <div className="bg-[var(--bg-tertiary)] p-3 rounded-2xl border border-[var(--border)]/50">
                  <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Last Sync</p>
                  <p className="text-sm font-bold truncate">
                    {guild.lastActiveSyncAt 
                      ? formatDistanceToNow(new Date(guild.lastActiveSyncAt), { addSuffix: true })
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-center gap-2 pt-2">
                <Link
                  href={`/g/${guild.id}`}
                  className="flex-1 h-10 px-4 bg-accent text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/10 hover:bg-accent-hover"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Roster
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${guild.name}"? This action cannot be undone.`)) {
                      deleteGuild.mutate(guild.id);
                    }
                  }}
                  className="w-10 h-10 bg-[var(--bg-tertiary)] hover:bg-red-500/10 border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 transition-all"
                  title="Delete Guild"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

