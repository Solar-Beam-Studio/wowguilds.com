"use client";

import Link from "next/link";
import { useGuilds, useDeleteGuild } from "@/hooks/use-guilds";
import { Plus, Trash2, ExternalLink, AlertCircle } from "lucide-react";

export default function GuildsPage() {
  const { data: guilds, isLoading } = useGuilds();
  const deleteGuild = useDeleteGuild();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight mb-2">My Guilds</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Your connected World of Warcraft guilds.</p>
        </div>

        <Link href="/guilds/new" className="h-11 px-6 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> Add Guild
        </Link>
      </div>

      {!guilds || guilds.length === 0 ? (
        <div className="bg-[var(--bg-tertiary)] rounded-[2rem] p-12 text-center border-2 border-dashed border-[var(--border)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--border)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-xl font-display font-bold mb-2">No Guilds Connected</h3>
            <p className="text-sm text-[var(--text-secondary)] font-medium mb-6">Add your first guild to start syncing data from Blizzard and Raider.IO.</p>
            <Link href="/guilds/new" className="h-11 px-6 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 flex items-center gap-2 justify-center">
              <Plus className="w-4 h-4" /> Add Your First Guild
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {guilds.map((guild) => (
            <div
              key={guild.id}
              className="group flex items-center justify-between bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Link href={`/g/${guild.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-accent font-black text-lg border border-[var(--border)] group-hover:bg-accent group-hover:text-white transition-all shrink-0">
                  {guild.name[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-lg group-hover:text-accent transition-colors truncate">{guild.name}</h2>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">
                    {guild.realm} — {guild.region.toUpperCase()} · {guild._count?.members ?? guild.memberCount} members
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Link
                  href={`/g/${guild.id}`}
                  className="h-9 px-4 bg-accent text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-accent/10 hover:bg-accent-hover"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Roster
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${guild.name}"? This cannot be undone.`)) {
                      deleteGuild.mutate(guild.id);
                    }
                  }}
                  className="w-9 h-9 bg-[var(--bg-tertiary)] hover:bg-red-500/10 border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 transition-all"
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
