"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  UserPlus,
  UserMinus,
  UsersRound,
  Trophy,
  Swords,
  Castle,
  ArrowUpCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { CLASS_COLORS } from "@wow/database/constants";

interface GuildEvent {
  id: number;
  type: string;
  characterName: string | null;
  characterClass: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

const EVENT_CONFIG: Record<
  string,
  { icon: typeof UserPlus; color: string; bgColor: string }
> = {
  member_joined: { icon: UserPlus, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  member_left: { icon: UserMinus, color: "text-red-400", bgColor: "bg-red-400/10" },
  mass_departure: { icon: UsersRound, color: "text-red-400", bgColor: "bg-red-400/10" },
  mplus_milestone: { icon: Trophy, color: "text-orange-400", bgColor: "bg-orange-400/10" },
  pvp_milestone: { icon: Swords, color: "text-red-400", bgColor: "bg-red-400/10" },
  raid_progress: { icon: Castle, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  player_returned: { icon: ArrowUpCircle, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  player_inactive: { icon: Clock, color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
};

function CharacterName({ name, characterClass }: { name: string; characterClass: string | null }) {
  const color = characterClass ? CLASS_COLORS[characterClass] : undefined;
  return (
    <span className="font-bold" style={color ? { color } : undefined}>
      {name}
    </span>
  );
}

function EventMessage({ event, t }: { event: GuildEvent; t: ReturnType<typeof useTranslations> }) {
  const data = event.data ?? {};
  const name = event.characterName;
  const cls = event.characterClass;

  switch (event.type) {
    case "member_joined":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("memberJoined")}</>;
    case "member_left":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("memberLeft")}</>;
    case "mass_departure":
      return <><span className="font-bold text-red-400">{(data.count as number) ?? "?"} {t("membersWord")}</span> {t("massDeparture")}</>;
    case "mplus_milestone":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("mplusMilestone", { score: String(data.milestone ?? data.newScore) })}</>;
    case "pvp_milestone":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("pvpMilestone", { rating: String(data.milestone ?? data.newRating), bracket: String(data.bracket ?? "") })}</>;
    case "raid_progress":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("raidProgress", { progress: String(data.newProgress ?? "") })}</>;
    case "player_returned":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("playerReturned")}</>;
    case "player_inactive":
      return <>{name && <CharacterName name={name} characterClass={cls} />} {t("playerInactive")}</>;
    default:
      return <>{event.type}</>;
  }
}

function getDateLabel(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("yesterday");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupEventsByDate(events: GuildEvent[], t: ReturnType<typeof useTranslations>) {
  const groups: Array<{ label: string; events: GuildEvent[] }> = [];
  let currentLabel = "";

  for (const event of events) {
    const label = getDateLabel(event.createdAt, t);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, events: [event] });
    } else {
      groups[groups.length - 1].events.push(event);
    }
  }

  return groups;
}

export function ActivityFeed({ guildId }: { guildId: string }) {
  const t = useTranslations("activityFeed");
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const fetchEvents = useCallback(
    async (cursor?: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("before", String(cursor));
        const res = await fetch(`/api/guilds/${guildId}/activity?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setEvents((prev) => (cursor ? [...prev, ...data.events] : data.events));
        setNextCursor(data.nextCursor);
      } finally {
        setLoading(false);
        setInitialLoaded(true);
      }
    },
    [guildId]
  );

  // Load on first render
  if (!initialLoaded && !loading) {
    fetchEvents();
  }

  if (!initialLoaded) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Clock className="w-10 h-10 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">{t("empty")}</p>
      </div>
    );
  }

  const groups = groupEventsByDate(events, t);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.events.map((event) => {
              const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.member_joined;
              const Icon = config.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <p className="text-sm text-gray-300 flex-1">
                    <EventMessage event={event} t={t} />
                  </p>
                  <time className="text-xs text-gray-600 flex-shrink-0">
                    {new Date(event.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchEvents(nextCursor)}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
