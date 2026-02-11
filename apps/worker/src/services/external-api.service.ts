import { CLASS_ID_MAP, RAID_NAMES, RAID_PRIORITY } from "@wow/database";
import type { BlizzardTokenService } from "./blizzard-token.service";

export interface CharacterData {
  source: string;
  characterClass: string;
  level: number;
  itemLevel: number;
  mythicPlusScore: number;
  currentSeason: string | null;
  pvp2v2Rating: number;
  pvp3v3Rating: number;
  pvpRbgRating: number;
  soloShuffleRating: number;
  maxSoloShuffleRating: number;
  rbgShuffleRating: number;
  achievementPoints: number;
  raidProgress: string | null;
  weeklyKeysCompleted: number;
  weeklyBestKeyLevel: number;
  weeklySlot2KeyLevel: number;
  weeklySlot3KeyLevel: number;
  lastUpdated: Date;
}

export interface RosterMember {
  name: string;
  realm: string;
  level: number;
  characterClass: string;
  characterApiUrl: string | null;
}

export interface ActivityData {
  lastLoginTimestamp: number | null;
  activityStatus: "active" | "inactive" | "unknown";
  daysSinceLogin: number | null;
  error?: string;
}

interface RaidProgressionData {
  total_bosses: number;
  normal_bosses_killed: number;
  heroic_bosses_killed: number;
  mythic_bosses_killed: number;
}

const VALID_REGIONS = ["us", "eu", "kr", "tw", "cn"];
const BLIZZARD_HOST_RE = /^https:\/\/[a-z]{2}\.api\.blizzard\.com\//;

function validateRegion(region: string): string {
  const r = region.toLowerCase();
  if (!VALID_REGIONS.includes(r)) throw new Error(`Invalid region: ${region}`);
  return r;
}

function validateBlizzardUrl(url: string): string {
  if (!BLIZZARD_HOST_RE.test(url)) throw new Error("Invalid Blizzard API URL");
  return url;
}

export interface GuildCrest {
  emblemId: number | null;
  emblemColor: string | null; // "r,g,b,a"
  borderId: number | null;
  borderColor: string | null;
  bgColor: string | null;
}

export class ExternalApiService {
  constructor(private tokenService: BlizzardTokenService) {}

  // ============================================================================
  // GUILD CREST
  // ============================================================================

  async getGuildCrest(
    guildName: string,
    realm: string,
    region: string
  ): Promise<GuildCrest> {
    const empty: GuildCrest = { emblemId: null, emblemColor: null, borderId: null, borderColor: null, bgColor: null };

    try {
      const r = validateRegion(region);
      const token = await this.tokenService.getToken();
      const normalizedGuild = encodeURIComponent(guildName.toLowerCase().replace(/\s+/g, "-"));
      const normalizedRealm = encodeURIComponent(realm.toLowerCase());

      const url = `https://${r}.api.blizzard.com/data/wow/guild/${normalizedRealm}/${normalizedGuild}?namespace=profile-${r}&locale=en_US`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return empty;

      const data = (await response.json()) as {
        crest?: {
          emblem?: { id?: number; color?: { rgba?: { r: number; g: number; b: number; a: number } } };
          border?: { id?: number; color?: { rgba?: { r: number; g: number; b: number; a: number } } };
          background?: { color?: { rgba?: { r: number; g: number; b: number; a: number } } };
        };
      };

      const c = data.crest;
      if (!c) return empty;

      const rgba = (obj?: { r: number; g: number; b: number; a: number }) =>
        obj ? `${obj.r},${obj.g},${obj.b},${obj.a}` : null;

      return {
        emblemId: c.emblem?.id ?? null,
        emblemColor: rgba(c.emblem?.color?.rgba),
        borderId: c.border?.id ?? null,
        borderColor: rgba(c.border?.color?.rgba),
        bgColor: rgba(c.background?.color?.rgba),
      };
    } catch {
      return empty;
    }
  }

  // ============================================================================
  // GUILD ROSTER
  // ============================================================================

  async getMembers(
    guildName: string,
    realm: string,
    region: string
  ): Promise<RosterMember[]> {
    const r = validateRegion(region);
    const token = await this.tokenService.getToken();
    const normalizedGuild = encodeURIComponent(
      guildName.toLowerCase().replace(/\s+/g, "-")
    );
    const normalizedRealm = encodeURIComponent(realm.toLowerCase());

    const url = `https://${r}.api.blizzard.com/data/wow/guild/${normalizedRealm}/${normalizedGuild}/roster?namespace=profile-${r}&locale=en_US`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Guild roster fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      members: Array<{
        character: {
          name: string;
          realm?: { slug: string };
          level: number;
          playable_class?: { id: number };
          key?: { href: string };
        };
      }>;
    };

    const members = data.members || [];
    return members.map((member) => ({
      name: member.character.name,
      realm: member.character.realm?.slug || realm,
      level: member.character.level,
      characterClass:
        CLASS_ID_MAP[member.character.playable_class?.id ?? 0] || "Unknown",
      characterApiUrl: member.character.key?.href || null,
    }));
  }

  // ============================================================================
  // CHARACTER DATA (dual-source: Raider.IO + Blizzard)
  // ============================================================================

  async getMember(
    name: string,
    realm: string,
    region: string,
    source: "raiderio" | "blizzard" | "auto" = "auto",
    characterApiUrl: string | null = null
  ): Promise<CharacterData> {
    if (source === "raiderio" || source === "auto") {
      try {
        return await this.getMemberFromRaiderIO(name, realm, region);
      } catch (error) {
        if (source === "auto") {
          return this.getMemberFromBlizzard(
            name,
            realm,
            region,
            characterApiUrl
          );
        }
        throw error;
      }
    }
    return this.getMemberFromBlizzard(name, realm, region, characterApiUrl);
  }

  // ============================================================================
  // RAIDER.IO
  // ============================================================================

  private async getMemberFromRaiderIO(
    name: string,
    realm: string,
    region: string
  ): Promise<CharacterData> {
    const r = validateRegion(region);
    const url = `https://raider.io/api/v1/characters/profile?region=${r}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=gear,mythic_plus_scores_by_season:current,mythic_plus_weekly_highest_level_runs,raid_progression`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Raider.IO fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      class?: string;
      gear?: { item_level_equipped?: number };
      mythic_plus_scores_by_season?: Array<{
        scores?: { all?: number };
        season?: string;
      }>;
      mythic_plus_weekly_highest_level_runs?: Array<{
        dungeon: string;
        mythic_level: number;
        num_keystone_upgrades: number;
      }>;
      raid_progression?: Record<string, RaidProgressionData>;
    };

    const characterClass = data.class || "Unknown";
    const itemLevel = data.gear?.item_level_equipped || 0;

    let mythicPlusScore = 0;
    let currentSeason: string | null = null;
    if (
      data.mythic_plus_scores_by_season &&
      data.mythic_plus_scores_by_season.length > 0
    ) {
      const season = data.mythic_plus_scores_by_season[0];
      mythicPlusScore = season.scores?.all || 0;
      currentSeason = season.season || null;
    }

    const weeklyRuns = data.mythic_plus_weekly_highest_level_runs || [];
    const weeklyKeysCompleted = weeklyRuns.length;
    const sortedLevels = weeklyRuns.map((r) => r.mythic_level).sort((a, b) => b - a);
    const weeklyBestKeyLevel = sortedLevels[0] ?? 0;
    const weeklySlot2KeyLevel = sortedLevels[3] ?? 0;
    const weeklySlot3KeyLevel = sortedLevels[7] ?? 0;

    let raidProgress: string | null = null;
    if (data.raid_progression) {
      const progressData = this.formatRaidProgression(data.raid_progression);
      raidProgress = progressData.currentRaid?.progress ?? null;
    }

    // Get Blizzard data for achievements and PvP
    let blizzardExtras = {
      achievementPoints: 0,
      pvp2v2Rating: 0,
      pvp3v3Rating: 0,
      pvpRbgRating: 0,
      soloShuffleRating: 0,
      maxSoloShuffleRating: 0,
      rbgShuffleRating: 0,
    };
    try {
      blizzardExtras = await this.getBlizzardAchievementsAndPvP(
        name,
        realm,
        region,
        characterClass
      );
    } catch {
      // Blizzard data is supplementary, continue without it
    }

    return {
      source: "raiderio+blizzard",
      characterClass,
      level: 80,
      itemLevel,
      mythicPlusScore,
      currentSeason,
      raidProgress,
      weeklyKeysCompleted,
      weeklyBestKeyLevel,
      weeklySlot2KeyLevel,
      weeklySlot3KeyLevel,
      ...blizzardExtras,
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // BLIZZARD ACHIEVEMENTS + PVP
  // ============================================================================

  private async getBlizzardAchievementsAndPvP(
    name: string,
    realm: string,
    region: string,
    characterClass: string
  ) {
    const r = validateRegion(region);
    const token = await this.tokenService.getToken();
    const normalizedRealm = encodeURIComponent(realm.toLowerCase());
    const normalizedName = encodeURIComponent(name.toLowerCase());
    const baseUrl = `https://${r}.api.blizzard.com/profile/wow/character/${normalizedRealm}/${normalizedName}`;
    const headers = { Authorization: `Bearer ${token}` };

    let achievementPoints = 0;
    let pvp2v2Rating = 0;
    let pvp3v3Rating = 0;
    let pvpRbgRating = 0;
    let soloShuffleRating = 0;
    let maxSoloShuffleRating = 0;
    let rbgShuffleRating = 0;

    // Get current PvP season ID
    let currentSeasonId: number | null = null;
    try {
      const seasonRes = await fetch(
        `https://${r}.api.blizzard.com/data/wow/pvp-season/index?namespace=dynamic-${r}&locale=en_US`,
        { headers }
      );
      if (seasonRes.ok) {
        const seasonData = (await seasonRes.json()) as {
          current_season?: { id: number };
        };
        currentSeasonId = seasonData.current_season?.id ?? null;
      }
    } catch {
      // Continue without season filter
    }

    // Achievements
    try {
      const achRes = await fetch(
        `${baseUrl}/achievements?namespace=profile-${r}&locale=en_US`,
        { headers }
      );
      if (achRes.ok) {
        const achData = (await achRes.json()) as { total_points?: number };
        achievementPoints = achData.total_points || 0;
      }
    } catch {
      // Non-critical
    }

    // Character profile for spec info
    let activeSpec = "";
    try {
      const charRes = await fetch(
        `${baseUrl}?namespace=profile-${r}&locale=en_US`,
        { headers }
      );
      if (charRes.ok) {
        const charData = (await charRes.json()) as {
          active_spec?: { name?: string };
        };
        activeSpec = charData.active_spec?.name?.toLowerCase() || "";
      }
    } catch {
      // Non-critical
    }

    // Helper to check season match
    const seasonMatches = (data: { season?: { id: number } }) =>
      !currentSeasonId || data.season?.id === currentSeasonId;

    // PvP brackets
    const brackets = [
      { key: "2v2", setter: (v: number) => (pvp2v2Rating = v) },
      { key: "3v3", setter: (v: number) => (pvp3v3Rating = v) },
      { key: "rbg", setter: (v: number) => (pvpRbgRating = v) },
    ];

    for (const bracket of brackets) {
      try {
        const res = await fetch(
          `${baseUrl}/pvp-bracket/${bracket.key}?namespace=profile-${r}&locale=en_US`,
          { headers }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            rating?: number;
            season?: { id: number };
          };
          if (seasonMatches(data)) {
            bracket.setter(data.rating || 0);
          }
        }
      } catch {
        // Non-critical
      }
    }

    // PvP Summary (Solo Shuffle + RBG Blitz)
    try {
      const summaryRes = await fetch(
        `${baseUrl}/pvp-summary?namespace=profile-${r}&locale=en_US`,
        { headers }
      );
      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as {
          brackets?: Array<{ href: string }>;
        };
        const allBrackets = summaryData.brackets || [];

        // Solo Shuffle
        const shuffleBrackets = allBrackets.filter((b) =>
          b.href.includes("/pvp-bracket/shuffle-") && BLIZZARD_HOST_RE.test(b.href)
        );
        for (const bracket of shuffleBrackets) {
          try {
            const res = await fetch(`${bracket.href}&locale=en_US`, {
              headers,
            });
            if (res.ok) {
              const data = (await res.json()) as {
                rating?: number;
                season_best_rating?: number;
                season?: { id: number };
              };
              if (seasonMatches(data)) {
                const rating = data.rating || 0;
                const maxRating = data.season_best_rating || rating;
                if (rating > soloShuffleRating) {
                  soloShuffleRating = rating;
                  maxSoloShuffleRating = maxRating;
                }
              }
            }
          } catch {
            // Non-critical
          }
        }

        // RBG Blitz
        const blitzBrackets = allBrackets.filter((b) =>
          b.href.includes("/pvp-bracket/blitz-") && BLIZZARD_HOST_RE.test(b.href)
        );
        for (const bracket of blitzBrackets) {
          try {
            const res = await fetch(`${bracket.href}&locale=en_US`, {
              headers,
            });
            if (res.ok) {
              const data = (await res.json()) as {
                rating?: number;
                season?: { id: number };
              };
              if (seasonMatches(data)) {
                const rating = data.rating || 0;
                if (rating > rbgShuffleRating) {
                  rbgShuffleRating = rating;
                }
              }
            }
          } catch {
            // Non-critical
          }
        }
      }
    } catch {
      // Non-critical
    }

    return {
      achievementPoints,
      pvp2v2Rating,
      pvp3v3Rating,
      pvpRbgRating,
      soloShuffleRating,
      maxSoloShuffleRating,
      rbgShuffleRating,
    };
  }

  // ============================================================================
  // BLIZZARD-ONLY CHARACTER DATA
  // ============================================================================

  private async getMemberFromBlizzard(
    name: string,
    realm: string,
    region: string,
    characterApiUrl: string | null = null
  ): Promise<CharacterData> {
    const r = validateRegion(region);
    const token = await this.tokenService.getToken();
    const headers = { Authorization: `Bearer ${token}` };

    let characterUrl: string;
    if (characterApiUrl && BLIZZARD_HOST_RE.test(characterApiUrl)) {
      characterUrl = characterApiUrl + "&locale=en_US";
    } else {
      const normalizedRealm = encodeURIComponent(realm.toLowerCase());
      const normalizedName = encodeURIComponent(name.toLowerCase());
      characterUrl = `https://${r}.api.blizzard.com/profile/wow/character/${normalizedRealm}/${normalizedName}?namespace=profile-${r}&locale=en_US`;
    }

    const charRes = await fetch(characterUrl, { headers });
    if (!charRes.ok) {
      throw new Error(`Blizzard character fetch failed: ${charRes.status}`);
    }

    const charData = (await charRes.json()) as {
      character_class?: { name: string };
      level?: number;
      equipped_item_level?: number;
      average_item_level?: number;
    };

    const characterClass = charData.character_class?.name || "Unknown";
    const level = charData.level || 0;
    const itemLevel =
      charData.equipped_item_level || charData.average_item_level || 0;

    const blizzardExtras = await this.getBlizzardAchievementsAndPvP(
      name,
      realm,
      region,
      characterClass
    );

    return {
      source: "blizzard",
      characterClass,
      level,
      itemLevel,
      mythicPlusScore: 0,
      currentSeason: null,
      raidProgress: null,
      weeklyKeysCompleted: 0,
      weeklyBestKeyLevel: 0,
      weeklySlot2KeyLevel: 0,
      weeklySlot3KeyLevel: 0,
      ...blizzardExtras,
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // ACTIVITY CHECKING
  // ============================================================================

  async getLastLoginTimestamp(
    name: string,
    realm: string,
    region: string
  ): Promise<ActivityData> {
    try {
      const r = validateRegion(region);
      const token = await this.tokenService.getToken();
      const normalizedRealm = encodeURIComponent(realm.toLowerCase());
      const normalizedName = encodeURIComponent(name.toLowerCase());
      const url = `https://${r}.api.blizzard.com/profile/wow/character/${normalizedRealm}/${normalizedName}?namespace=profile-${r}&locale=en_US`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            lastLoginTimestamp: null,
            activityStatus: "inactive",
            daysSinceLogin: null,
            error: "character_not_found",
          };
        }
        throw new Error(`Activity check failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        last_login_timestamp?: number;
      };

      if (data.last_login_timestamp) {
        const lastLogin = new Date(data.last_login_timestamp);
        const daysSince = Math.floor(
          (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          lastLoginTimestamp: data.last_login_timestamp,
          activityStatus: daysSince <= 30 ? "active" : "inactive",
          daysSinceLogin: daysSince,
        };
      }

      return {
        lastLoginTimestamp: null,
        activityStatus: "inactive",
        daysSinceLogin: null,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("character_not_found")
      ) {
        throw error;
      }
      throw error;
    }
  }

  async bulkCheckActivity(
    characters: Array<{ name: string; realm: string }>,
    region: string
  ): Promise<
    Array<{
      characterName: string;
      realm: string;
      activityData: ActivityData;
    }>
  > {
    const results: Array<{
      characterName: string;
      realm: string;
      activityData: ActivityData;
    }> = [];

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      try {
        const activityData = await this.getLastLoginTimestamp(
          char.name,
          char.realm,
          region
        );
        results.push({
          characterName: char.name,
          realm: char.realm,
          activityData,
        });
      } catch {
        results.push({
          characterName: char.name,
          realm: char.realm,
          activityData: {
            lastLoginTimestamp: null,
            activityStatus: "unknown",
            daysSinceLogin: null,
            error: "fetch_failed",
          },
        });
      }

      // Rate limit: 200ms between requests
      if (i < characters.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return results;
  }

  // ============================================================================
  // RAID PROGRESSION
  // ============================================================================

  private formatRaidProgression(
    raidProgression: Record<string, RaidProgressionData>
  ) {
    const allRaids: Array<{
      key: string;
      name: string;
      progress: string;
      priority: number;
    }> = [];

    for (const [raidKey, raidData] of Object.entries(raidProgression)) {
      if (raidData.total_bosses > 0) {
        const raidName =
          RAID_NAMES[raidKey] ||
          raidKey
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

        let progress = "";
        if (raidData.mythic_bosses_killed > 0) {
          progress = `${raidData.mythic_bosses_killed}/${raidData.total_bosses} M`;
        } else if (raidData.heroic_bosses_killed > 0) {
          progress = `${raidData.heroic_bosses_killed}/${raidData.total_bosses} H`;
        } else if (raidData.normal_bosses_killed > 0) {
          progress = `${raidData.normal_bosses_killed}/${raidData.total_bosses} N`;
        }

        const priority = RAID_PRIORITY.indexOf(raidKey);
        if (progress || priority === 0) {
          if (!progress) progress = `0/${raidData.total_bosses}`;
          allRaids.push({ key: raidKey, name: raidName, progress, priority });
        }
      }
    }

    allRaids.sort((a, b) => {
      if (a.priority === -1 && b.priority === -1) return 0;
      if (a.priority === -1) return 1;
      if (b.priority === -1) return -1;
      return a.priority - b.priority;
    });

    return {
      raids: allRaids,
      currentRaid: allRaids[0] || null,
      summary: allRaids[0]
        ? `${allRaids[0].name}: ${allRaids[0].progress}`
        : "No progress",
    };
  }
}
