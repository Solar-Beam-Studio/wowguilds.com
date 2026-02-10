"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Radar } from "lucide-react";
import { guildPath } from "@/lib/guild-url";
import { GuildCrest } from "@/components/guild-crest";

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
  crestEmblemId: number | null;
  crestEmblemColor: string | null;
  crestBorderId: number | null;
  crestBorderColor: string | null;
  crestBgColor: string | null;
}

interface FeedItem {
  id: string;
  type: string;
  guildId: string;
  guildName?: string;
  guildRealm?: string;
  guildRegion?: string;
  crestEmblemId?: number | null;
  crestEmblemColor?: string | null;
  crestBorderId?: number | null;
  crestBorderColor?: string | null;
  crestBgColor?: string | null;
  timestamp: string;
  data?: Record<string, unknown>;
  isLive?: boolean;
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
    crestEmblemId: s.crestEmblemId,
    crestEmblemColor: s.crestEmblemColor,
    crestBorderId: s.crestBorderId,
    crestBorderColor: s.crestBorderColor,
    crestBgColor: s.crestBgColor,
    timestamp: s.completedAt || new Date().toISOString(),
    data: { processedItems: s.processedItems, total: s.totalItems, duration: s.duration },
  }));
}

const MAX_ITEMS = 20;

export function ActivitySidebar({ seed }: { seed: SeedItem[] }) {
  const tc = useTranslations("common");
  const ta = useTranslations("activity");
  const [items, setItems] = useState<FeedItem[]>(() => seedToFeedItems(seed));
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 10) return tc("justNow");
    if (secs < 60) return tc("secsAgo", { n: secs });
    const mins = Math.floor(secs / 60);
    if (mins < 60) return tc("minsAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tc("hoursAgo", { n: hours });
    return tc("daysAgo", { n: Math.floor(hours / 24) });
  }

  function eventLabel(item: FeedItem): string {
    const data = item.data || {};
    switch (item.type) {
      case "discovery:complete":
      case "discovery": {
        const count = data.total || data.processedItems || 0;
        return tc("rosterSynced", { count: String(count) });
      }
      case "sync:complete":
      case "active_sync": {
        const count = data.synced || data.processedItems || 0;
        return tc("statsUpdated", { count: String(count) });
      }
      default:
        return tc("syncEvent");
    }
  }

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
    <aside className="w-[380px] shrink-0 hidden xl:flex flex-col border-l border-white/5 bg-[#0b0b0d]/40 backdrop-blur-3xl h-[calc(100vh-80px)] sticky top-20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            {connected && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-violet-500 animate-ping" />
            )}
          </div>
          <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">
            {ta("liveActivity")}
          </h2>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 space-y-1 min-h-0">
        {items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-xs text-gray-500">{ta("waitingForEvents")}</p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.guildName && item.guildRealm && item.guildRegion
                ? guildPath({ name: item.guildName, realm: item.guildRealm, region: item.guildRegion })
                : `/g/${item.guildId}`}
              className={`flex items-start gap-3.5 p-4 rounded-2xl transition-all group hover:bg-white/[0.03] border border-transparent hover:border-white/5 ${
                item.isLive ? "animate-in fade-in slide-in-from-top-1 duration-300" : ""
              }`}
            >
              <GuildCrest
                emblemId={item.crestEmblemId ?? null}
                emblemColor={item.crestEmblemColor ?? null}
                borderId={item.crestBorderId ?? null}
                borderColor={item.crestBorderColor ?? null}
                bgColor={item.crestBgColor ?? null}
                size={48}
                className="rounded-xl shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-bold truncate group-hover:text-violet-400 transition-colors leading-tight">
                    {item.guildName || "Unknown Guild"}
                  </p>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-snug mt-1 truncate">
                  {eventLabel(item)}
                </p>
                {item.guildRealm && item.guildRegion && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {item.guildRealm}-{item.guildRegion.toUpperCase()}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Scanner footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
          <Radar className="w-4 h-4 text-violet-500 animate-spin" style={{ animationDuration: "3s" }} />
          <p className="text-[11px] text-gray-500 font-medium">
            {ta("scanningRealms")}
          </p>
        </div>
      </div>
    </aside>
  );
}
