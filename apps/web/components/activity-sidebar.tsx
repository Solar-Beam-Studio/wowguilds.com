"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { Radio, RefreshCw, Users, Swords, User } from "lucide-react";

interface SeedItem {
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

interface FeedItem {
  id: string;
  type: string;
  guildId: string;
  guildName?: string;
  guildRealm?: string;
  guildRegion?: string;
  timestamp: string;
  data?: Record<string, unknown>;
  isLive?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function eventLabel(item: FeedItem): string {
  const data = item.data || {};
  switch (item.type) {
    case "discovery:complete":
    case "discovery":
      return `${data.total || data.processedItems || "?"} members discovered`;
    case "sync:complete":
    case "active_sync":
      return `${data.synced || data.processedItems || "?"} characters synced`;
    case "member:updated":
      return `${data.characterName || "Character"} updated`;
    default:
      return "Sync event";
  }
}

function eventIcon(type: string) {
  switch (type) {
    case "discovery:complete":
    case "discovery":
      return <Users className="w-3 h-3 text-blue-400" />;
    case "sync:complete":
    case "active_sync":
      return <RefreshCw className="w-3 h-3 text-accent" />;
    case "member:updated":
      return <User className="w-3 h-3 text-green-400" />;
    default:
      return <Swords className="w-3 h-3 text-[var(--text-secondary)]" />;
  }
}

// Convert server-rendered seed data to FeedItem format
function seedToFeedItems(seeds: SeedItem[]): FeedItem[] {
  return seeds.map((s) => ({
    id: s.id,
    type: s.type,
    guildId: s.guildId,
    guildName: s.guildName,
    guildRealm: s.guildRealm,
    guildRegion: s.guildRegion,
    timestamp: s.completedAt || new Date().toISOString(),
    data: { processedItems: s.processedItems, total: s.totalItems, duration: s.duration },
  }));
}

const MAX_ITEMS = 20;

export function ActivitySidebar({ seed }: { seed: SeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(() => seedToFeedItems(seed));
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/activity");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          setConnected(true);
          return;
        }

        const newItem: FeedItem = {
          id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: data.type,
          guildId: data.guildId,
          guildName: data.guildName,
          guildRealm: data.guildRealm,
          guildRegion: data.guildRegion,
          timestamp: data.timestamp || new Date().toISOString(),
          data: data.data,
          isLive: true,
        };

        setItems((prev) => [newItem, ...prev].slice(0, MAX_ITEMS));
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Tick to update relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-full md:w-56 lg:w-64 shrink-0 hidden lg:block">
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-3 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 mb-3">
          <div className="relative">
            <Radio className="w-3.5 h-3.5 text-green-500" />
            {connected && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <h2 className="text-[10px] font-display font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">
            Live Activity
          </h2>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {items.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="text-[10px] text-[var(--text-secondary)]">Waiting for sync events...</p>
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/g/${item.guildId}`}
                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl transition-all group hover:bg-[var(--bg-tertiary)] ${
                  item.isLive ? "animate-in fade-in slide-in-from-top-1 duration-300" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--border)] group-hover:border-accent/30">
                  {eventIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold truncate group-hover:text-accent transition-colors leading-tight">
                    {item.guildName || "Unknown Guild"}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-snug mt-0.5 truncate">
                    {eventLabel(item)}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] opacity-50 mt-0.5">
                    {item.guildRealm && item.guildRegion
                      ? `${item.guildRealm}-${item.guildRegion.toUpperCase()} · `
                      : ""}
                    {timeAgo(item.timestamp)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
