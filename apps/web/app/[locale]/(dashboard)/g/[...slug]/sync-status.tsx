"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, HelpCircle } from "lucide-react";
import { toast } from "sonner";

function useTimeAgo() {
  const tc = useTranslations("common");
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 10) return tc("justNow");
    if (secs < 60) return tc("secsAgo", { n: secs });
    const mins = Math.floor(secs / 60);
    if (mins < 60) return tc("minsAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tc("hoursAgo", { n: hours });
    return tc("daysAgo", { n: Math.floor(hours / 24) });
  };
}

const COOLDOWN_SECONDS = 60;

export function SyncStatus({
  guildId,
  lastSyncedAt,
  syncIntervalMin,
  discoveryIntervalHours,
}: {
  guildId: string;
  lastSyncedAt: string | null;
  syncIntervalMin: number;
  discoveryIntervalHours: number;
}) {
  const t = useTranslations("guildDetail");
  const timeAgo = useTimeAgo();
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [, setTick] = useState(0);
  const infoRef = useRef<HTMLDivElement>(null);

  // SSE — listen for sync events
  useEffect(() => {
    const es = new EventSource(`/api/guilds/${guildId}/events`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "sync:complete" || data.type === "discovery:complete") {
          setLastSynced(new Date().toISOString());
          setIsSyncing(false);
        } else if (data.type === "sync:progress" || data.type === "discovery:progress") {
          setIsSyncing(true);
        }
      } catch {}
    };

    es.onerror = () => {};

    return () => es.close();
  }, [guildId]);

  // Tick for relative time freshness
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Close info popover on outside click
  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInfo]);

  async function handleRefresh() {
    if (cooldown > 0 || isSyncing) return;

    try {
      const res = await fetch(`/api/guilds/${guildId}/sync`, { method: "POST" });
      if (res.status === 429) {
        toast.error(t("syncTooMany"));
        return;
      }
      if (!res.ok) {
        toast.error(t("syncError"));
        return;
      }
      toast.success(t("syncTriggered"));
      setIsSyncing(true);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      toast.error(t("syncError"));
    }
  }

  const isDisabled = cooldown > 0 || isSyncing;

  return (
    <div className="flex items-center gap-3 mt-1.5">
      {/* Timestamp */}
      <span className="text-[11px] text-gray-500 font-medium">
        {!lastSynced
          ? t("firstSync")
          : isSyncing
            ? t("syncing")
            : t("updatedAgo", { time: timeAgo(lastSynced) })}
      </span>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isDisabled}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-violet-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
        title={t("refreshSync")}
      >
        <RefreshCw
          className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
        />
        {cooldown > 0 && <span>{cooldown}s</span>}
      </button>

      {/* Info tooltip */}
      <div className="relative" ref={infoRef}>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        {showInfo && (
          <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-white/10 bg-[#111113] p-4 shadow-xl text-[11px] text-gray-400 space-y-1.5">
            <p className="text-xs font-bold text-gray-300">{t("syncInfoTitle")}</p>
            <p>{t("syncInfoStats", { min: syncIntervalMin })}</p>
            <p>{t("syncInfoRoster", { hours: discoveryIntervalHours })}</p>
            <p>{t("syncInfoSource")}</p>
            <p>{t("syncInfoManual")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
