import { prisma } from "@wow/database";
import { CLASS_COLORS } from "@wow/database";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/stats",
      languages: { en: "/stats", fr: "/fr/stats" },
    },
  };
}

export default async function StatsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("stats");

  // All queries in parallel
  const [
    totalGuilds,
    totalMembers,
    activeMembers,
    classStats,
    topMPlus,
    topPvp,
    avgStats,
  ] = await Promise.all([
    prisma.guild.count(),
    prisma.guildMember.count(),
    prisma.guildMember.count({ where: { activityStatus: "active" } }),
    prisma.guildMember.groupBy({
      by: ["characterClass"],
      where: { characterClass: { not: null } },
      _count: { id: true },
      _avg: { mythicPlusScore: true, itemLevel: true },
      orderBy: { _avg: { mythicPlusScore: "desc" } },
    }),
    prisma.guildMember.findMany({
      where: { mythicPlusScore: { gt: 0 } },
      orderBy: { mythicPlusScore: "desc" },
      take: 20,
      select: {
        characterName: true,
        realm: true,
        characterClass: true,
        mythicPlusScore: true,
        itemLevel: true,
        guild: { select: { name: true, region: true, realm: true } },
      },
    }),
    prisma.guildMember.findMany({
      where: { soloShuffleRating: { gt: 0 } },
      orderBy: { soloShuffleRating: "desc" },
      take: 20,
      select: {
        characterName: true,
        realm: true,
        characterClass: true,
        soloShuffleRating: true,
        guild: { select: { name: true, region: true, realm: true } },
      },
    }),
    prisma.guildMember.aggregate({
      _avg: { itemLevel: true, mythicPlusScore: true },
      where: { itemLevel: { gt: 0 } },
    }),
  ]);

  const avgIlvl = Math.round((avgStats._avg.itemLevel || 0) * 10) / 10;

  // JSON-LD — all values are computed from our own DB, safe for serialization
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "World of Warcraft Class Performance Statistics",
    description: `Live class rankings and player statistics from ${totalMembers} tracked characters across ${totalGuilds} guilds.`,
    url: "https://wowguilds.com/stats",
    publisher: { "@type": "Organization", name: "WoW Guilds" },
    temporalCoverage: new Date().toISOString().split("T")[0],
    variableMeasured: [
      "Mythic+ Score",
      "Item Level",
      "PvP Rating",
      "Activity Status",
    ],
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-10 md:py-16">
      {/* All values in jsonLd are computed from our own database, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">
        {t("title")}
      </h1>
      <p className="text-gray-500 text-sm font-bold tracking-wide mb-10">
        {t("description", {
          members: totalMembers.toLocaleString(),
          guilds: totalGuilds,
        })}
      </p>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: t("guildsTracked"), value: totalGuilds },
          { label: t("totalCharacters"), value: totalMembers.toLocaleString() },
          { label: t("activeCharacters"), value: activeMembers.toLocaleString() },
          { label: t("avgItemLevel"), value: avgIlvl },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl border border-white/5">
            <p className="text-2xl font-black">{stat.value}</p>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Class M+ Tier List */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
          {t("classMplusRankings")}
        </h2>
        <div className="space-y-2">
          {classStats.map((cls, i) => {
            const name = cls.characterClass!;
            const color = CLASS_COLORS[name] || "#888";
            const avgScore = Math.round(cls._avg.mythicPlusScore || 0);
            const classAvgIlvl = Math.round((cls._avg.itemLevel || 0) * 10) / 10;
            const maxScore = classStats[0]?._avg.mythicPlusScore || 1;
            const pct = Math.round(((cls._avg.mythicPlusScore || 0) / maxScore) * 100);

            return (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-5 text-right font-mono">
                  {i + 1}
                </span>
                <span
                  className="text-sm font-bold w-28 truncate"
                  style={{ color }}
                >
                  {name}
                </span>
                <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg opacity-30"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-bold text-white">
                    {avgScore} M+ · {classAvgIlvl} ilvl · {cls._count.id} {t("players")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top M+ Players */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
          {t("topMplus")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("character")}</th>
                <th>{t("guild")}</th>
                <th>{t("class")}</th>
                <th className="text-right">M+</th>
                <th className="text-right">iLvl</th>
              </tr>
            </thead>
            <tbody>
              {topMPlus.map((p, i) => (
                <tr key={`${p.characterName}-${p.realm}`}>
                  <td className="text-gray-600 font-mono text-xs">{i + 1}</td>
                  <td className="font-bold">{p.characterName}</td>
                  <td>
                    <Link
                      href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {p.guild.name}
                    </Link>
                  </td>
                  <td
                    className="text-sm"
                    style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}
                  >
                    {p.characterClass}
                  </td>
                  <td className="text-right font-mono font-bold">
                    {p.mythicPlusScore}
                  </td>
                  <td className="text-right font-mono text-gray-400">
                    {p.itemLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top PvP (Solo Shuffle) */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
          {t("topSoloShuffle")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("character")}</th>
                <th>{t("guild")}</th>
                <th>{t("class")}</th>
                <th className="text-right">{t("rating")}</th>
              </tr>
            </thead>
            <tbody>
              {topPvp.map((p, i) => (
                <tr key={`${p.characterName}-${p.realm}`}>
                  <td className="text-gray-600 font-mono text-xs">{i + 1}</td>
                  <td className="font-bold">{p.characterName}</td>
                  <td>
                    <Link
                      href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {p.guild.name}
                    </Link>
                  </td>
                  <td
                    className="text-sm"
                    style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}
                  >
                    {p.characterClass}
                  </td>
                  <td className="text-right font-mono font-bold">
                    {p.soloShuffleRating}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-gray-600 mt-8">
        {t("dataNote")}
      </p>
    </div>
  );
}
