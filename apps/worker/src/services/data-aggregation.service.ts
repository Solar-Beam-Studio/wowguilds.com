import { prisma } from "@wow/database";

interface ClassStat {
  characterClass: string;
  count: number;
  avgMythicPlusScore: number;
  avgItemLevel: number;
}

interface TopPlayer {
  characterName: string;
  realm: string;
  guildName: string;
  characterClass: string;
  mythicPlusScore: number;
  itemLevel: number;
}

interface PvpBracket {
  bracket: string;
  count: number;
}

interface RaidStat {
  raidProgress: string;
  count: number;
}

interface OverviewStats {
  totalGuilds: number;
  totalMembers: number;
  activeMembers: number;
  avgItemLevel: number;
  avgMythicPlusScore: number;
}

export class DataAggregationService {
  async getClassDistribution(): Promise<ClassStat[]> {
    const members = await prisma.guildMember.groupBy({
      by: ["characterClass"],
      where: { characterClass: { not: null } },
      _count: { id: true },
      _avg: { mythicPlusScore: true, itemLevel: true },
      orderBy: { _count: { id: "desc" } },
    });

    return members.map((m) => ({
      characterClass: m.characterClass!,
      count: m._count.id,
      avgMythicPlusScore: Math.round(m._avg.mythicPlusScore || 0),
      avgItemLevel: Math.round((m._avg.itemLevel || 0) * 10) / 10,
    }));
  }

  async getTopMythicPlusScores(limit = 20): Promise<TopPlayer[]> {
    const top = await prisma.guildMember.findMany({
      where: { mythicPlusScore: { gt: 0 } },
      orderBy: { mythicPlusScore: "desc" },
      take: limit,
      include: { guild: { select: { name: true } } },
    });

    return top.map((m) => ({
      characterName: m.characterName,
      realm: m.realm,
      guildName: m.guild.name,
      characterClass: m.characterClass || "Unknown",
      mythicPlusScore: m.mythicPlusScore || 0,
      itemLevel: m.itemLevel || 0,
    }));
  }

  async getPvpRatingDistribution(): Promise<PvpBracket[]> {
    const brackets = [
      { label: "Unranked (0)", min: 0, max: 0 },
      { label: "Combatant (1-1399)", min: 1, max: 1399 },
      { label: "Challenger (1400-1599)", min: 1400, max: 1599 },
      { label: "Rival (1600-1799)", min: 1600, max: 1799 },
      { label: "Duelist (1800-2099)", min: 1800, max: 2099 },
      { label: "Elite (2100+)", min: 2100, max: 999999 },
    ];

    const results: PvpBracket[] = [];
    for (const b of brackets) {
      const count = await prisma.guildMember.count({
        where: {
          soloShuffleRating: { gte: b.min, lte: b.max },
        },
      });
      if (count > 0) {
        results.push({ bracket: b.label, count });
      }
    }
    return results;
  }

  async getRaidProgressStats(): Promise<RaidStat[]> {
    const members = await prisma.guildMember.groupBy({
      by: ["raidProgress"],
      where: { raidProgress: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });

    return members.map((m) => ({
      raidProgress: m.raidProgress!,
      count: m._count.id,
    }));
  }

  async getOverviewStats(): Promise<OverviewStats> {
    const [totalGuilds, totalMembers, activeMembers, avgStats] =
      await Promise.all([
        prisma.guild.count(),
        prisma.guildMember.count(),
        prisma.guildMember.count({
          where: { activityStatus: "active" },
        }),
        prisma.guildMember.aggregate({
          _avg: { itemLevel: true, mythicPlusScore: true },
          where: { itemLevel: { gt: 0 } },
        }),
      ]);

    return {
      totalGuilds,
      totalMembers,
      activeMembers,
      avgItemLevel:
        Math.round((avgStats._avg.itemLevel || 0) * 10) / 10,
      avgMythicPlusScore: Math.round(
        avgStats._avg.mythicPlusScore || 0
      ),
    };
  }

  async getStatsForCategory(
    category: string
  ): Promise<Record<string, unknown>> {
    switch (category) {
      case "m-plus":
        return {
          topPlayers: await this.getTopMythicPlusScores(10),
          classDist: await this.getClassDistribution(),
          overview: await this.getOverviewStats(),
        };
      case "pvp":
        return {
          pvpBrackets: await this.getPvpRatingDistribution(),
          classDist: await this.getClassDistribution(),
          overview: await this.getOverviewStats(),
        };
      case "raids":
        return {
          raidProgress: await this.getRaidProgressStats(),
          overview: await this.getOverviewStats(),
        };
      default:
        return {
          overview: await this.getOverviewStats(),
          classDist: await this.getClassDistribution(),
        };
    }
  }
}
