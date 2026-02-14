import { RAID_NAMES, RAID_PRIORITY } from "@wow/database";

interface SeasonInfo {
  name: string;
  slug: string;
  dungeons: string[];
}

interface GameContext {
  expansion: string;
  currentSeason: string;
  currentDungeons: string[];
  currentRaid: string;
  raidTier: string;
  date: string;
}

export class GameContextService {
  async getCurrentContext(): Promise<GameContext> {
    const date = new Date().toISOString().split("T")[0];

    // Fetch current season from Raider.IO (free, no auth)
    let season: SeasonInfo | null = null;
    try {
      const res = await fetch(
        "https://raider.io/api/v1/mythic-plus/static-data?expansion_id=10"
      );
      if (res.ok) {
        const data = await res.json();
        season = this.findCurrentSeason(data.seasons || []);
      }
    } catch (e) {
      console.warn("[GameContext] Raider.IO unavailable:", e);
    }

    // Current raid from our own constants (ordered by priority)
    const currentRaidSlug = RAID_PRIORITY[0] || "liberation-of-undermine";
    const currentRaid = RAID_NAMES[currentRaidSlug] || currentRaidSlug;

    return {
      expansion: "The War Within",
      currentSeason: season?.name || "TWW Season",
      currentDungeons: season?.dungeons || [],
      currentRaid,
      raidTier: RAID_PRIORITY[0] || "",
      date,
    };
  }

  private findCurrentSeason(
    seasons: Array<{
      name: string;
      slug: string;
      starts?: Record<string, string>;
      ends?: Record<string, string>;
      dungeons?: Array<{ name: string }>;
    }>
  ): SeasonInfo | null {
    const now = Date.now();

    // Find the season we're currently in
    for (const s of seasons) {
      const start = s.starts?.us
        ? new Date(s.starts.us).getTime()
        : 0;
      const end = s.ends?.us
        ? new Date(s.ends.us).getTime()
        : Infinity;

      if (start <= now && now <= end) {
        return {
          name: s.name,
          slug: s.slug,
          dungeons: (s.dungeons || []).map((d) => d.name),
        };
      }
    }

    // Fallback: return the most recent season that has started
    const started = seasons
      .filter((s) => s.starts?.us && new Date(s.starts.us).getTime() <= now)
      .sort(
        (a, b) =>
          new Date(b.starts!.us).getTime() -
          new Date(a.starts!.us).getTime()
      );

    if (started.length > 0) {
      const s = started[0];
      return {
        name: s.name,
        slug: s.slug,
        dungeons: (s.dungeons || []).map((d) => d.name),
      };
    }

    return null;
  }

  formatForPrompt(ctx: GameContext): string {
    return `CURRENT WOW GAME STATE (as of ${ctx.date}):
- Expansion: ${ctx.expansion}
- Current M+ Season: ${ctx.currentSeason}
- Current M+ Dungeons: ${ctx.currentDungeons.join(", ") || "Unknown"}
- Current Raid: ${ctx.currentRaid}
- PvP Season: ${ctx.currentSeason}`;
  }
}
