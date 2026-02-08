export interface GuildMember {
  id: number;
  guildId: string;
  characterName: string;
  realm: string;
  characterClass: string | null;
  level: number | null;
  itemLevel: number | null;
  mythicPlusScore: number | null;
  currentSeason: string | null;
  pvp2v2Rating: number;
  pvp3v3Rating: number;
  pvpRbgRating: number;
  soloShuffleRating: number;
  maxSoloShuffleRating: number;
  rbgShuffleRating: number;
  achievementPoints: number;
  raidProgress: string | null;
  lastLoginTimestamp: number | null;
  activityStatus: string;
  lastUpdated: string;
}
