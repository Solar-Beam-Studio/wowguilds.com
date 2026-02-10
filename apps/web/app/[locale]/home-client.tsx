"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GuildSearch } from "@/components/guild-search";
import { AppLogo } from "@/components/app-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { GuildCrest } from "@/components/guild-crest";
import { Footer } from "@/components/footer";
import { Eye, Activity, Users, Clock, History } from "lucide-react";

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
  crestEmblemId: number | null;
  crestEmblemColor: string | null;
  crestBorderId: number | null;
  crestBorderColor: string | null;
  crestBgColor: string | null;
}

interface RecentGuild {
  id: string;
  name: string;
  realm: string;
  region: string;
  memberCount: number;
  updatedAt: string;
  crestEmblemId: number | null;
  crestEmblemColor: string | null;
  crestBorderId: number | null;
  crestBorderColor: string | null;
  crestBgColor: string | null;
}

interface RecentSearch {
  id: string;
  name: string;
  realm: string;
  region: string;
}

interface HomeClientProps {
  guilds: { id: string }[];
  totalMembers: number;
  activeMembers: number;
  recentActivity: ActivityItem[];
  recentGuilds: RecentGuild[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function eventLabel(type: string, total: number, processed: number): string {
  switch (type) {
    case "discovery:complete":
    case "discovery":
      return `Roster synced · ${total || processed} members`;
    case "sync:complete":
    case "active_sync":
      return `Stats updated · ${processed} characters`;
    default:
      return "Sync event";
  }
}

export function HomeClient({ guilds, totalMembers, activeMembers, recentActivity, recentGuilds }: HomeClientProps) {
  const t = useTranslations("home");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent_guild_searches");
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen text-white relative z-10">
      {/* Header */}
      <header className="w-full px-8 py-5 flex items-center justify-between animate-fade-in delay-0">
        <AppLogo href="/" mode="full" />
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
            <span>{guilds.length} guilds</span>
            <span className="text-white/10">/</span>
            <span>{totalMembers.toLocaleString()} characters</span>
            <span className="text-white/10">/</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>{activeMembers.toLocaleString()} active</span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero — Google-style centered search */}
      <section className="flex flex-col items-center pt-24 md:pt-32 pb-16 text-center px-4">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-[0.95] animate-fade-up delay-1">
          WOW<span className="text-violet-500">GUILDS</span>.COM
        </h1>
        <p className="text-base md:text-lg text-gray-400 mt-4 font-medium max-w-md animate-fade-up delay-2">
          {t("subtitle")}
        </p>

        <div className="animate-scale-in delay-3">
          <GuildSearch />
        </div>

        {/* Value props */}
        <div className="flex flex-wrap justify-center gap-6 mt-8 animate-fade-up delay-4">
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
            <Eye className="w-3.5 h-3.5 text-violet-500" />
            {t("valueProp1")}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
            <Activity className="w-3.5 h-3.5 text-violet-500" />
            {t("valueProp2")}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
            <Users className="w-3.5 h-3.5 text-violet-500" />
            {t("valueProp3")}
          </div>
        </div>

        {/* Recent syncs — stock ticker */}
        {recentActivity.length > 0 && (
          <div className="mt-10 w-full max-w-3xl overflow-hidden animate-fade-in delay-5" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
            <div className="flex items-center gap-4 animate-ticker w-max">
              {/* Duplicate items for seamless loop */}
              {[...recentActivity.slice(0, 5), ...recentActivity.slice(0, 5)].map((item, i) => (
                <Link
                  key={`${item.id}-${i}`}
                  href={`/g/${item.guildId}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all group shrink-0"
                >
                  <GuildCrest
                    emblemId={item.crestEmblemId}
                    emblemColor={item.crestEmblemColor}
                    borderId={item.crestBorderId}
                    borderColor={item.crestBorderColor}
                    bgColor={item.crestBgColor}
                    size={24}
                  />
                  <span className="text-xs font-bold group-hover:text-violet-400 transition-colors whitespace-nowrap">
                    {item.guildName}
                  </span>
                  <span className="text-[10px] text-gray-600 whitespace-nowrap">
                    {eventLabel(item.type, item.totalItems, item.processedItems)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Recently searched + Recently updated */}
      <section className="max-w-3xl mx-auto px-4 pb-20 space-y-10">
        {/* Recently Searched (from localStorage) */}
        {recentSearches.length > 0 && (
          <div className="animate-fade-up delay-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                Recently Searched
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <Link
                  key={s.id}
                  href={`/g/${s.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all group"
                >
                  <span className="text-xs font-bold group-hover:text-violet-400 transition-colors">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {s.realm}-{s.region.toUpperCase()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recently Updated (from server) */}
        {recentGuilds.length > 0 && (
          <div className="animate-fade-up delay-7">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                Recently Updated
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentGuilds.map((g) => (
                <Link
                  key={g.id}
                  href={`/g/${g.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all group"
                >
                  <GuildCrest
                    emblemId={g.crestEmblemId}
                    emblemColor={g.crestEmblemColor}
                    borderId={g.crestBorderId}
                    borderColor={g.crestBorderColor}
                    bgColor={g.crestBgColor}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold group-hover:text-violet-400 transition-colors truncate">
                      {g.name}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {g.realm}-{g.region.toUpperCase()} · {g.memberCount} members · {timeAgo(g.updatedAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="animate-fade-in delay-8">
        <Footer />
      </div>
    </div>
  );
}
