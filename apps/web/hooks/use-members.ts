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
  weeklyKeysCompleted: number;
  weeklyBestKeyLevel: number;
  weeklySlot2KeyLevel: number;
  weeklySlot3KeyLevel: number;
  lastLoginTimestamp: number | null;
  activityStatus: string;
  lastUpdated: string;
}
