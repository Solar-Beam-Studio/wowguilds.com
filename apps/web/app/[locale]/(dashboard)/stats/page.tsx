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
      take: 10,
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
      take: 10,
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
          <div key={stat.label} className="glass rounded-3xl p-6 border border-white/5">
            <p className="text-3xl font-mono tabular-nums font-bold">{stat.value}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mt-2">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Class M+ Rankings */}
      <section className="glass rounded-3xl p-6 border border-white/5 mb-12">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6">
          {t("classMplusRankings")}
        </h2>
        <div className="space-y-3">
          {classStats.map((cls, i) => {
            const name = cls.characterClass!;
            const color = CLASS_COLORS[name] || "#888";
            const avgScore = Math.round(cls._avg.mythicPlusScore || 0);
            const classAvgIlvl = Math.round((cls._avg.itemLevel || 0) * 10) / 10;
            const maxScore = classStats[0]?._avg.mythicPlusScore || 1;
            const pct = Math.round(((cls._avg.mythicPlusScore || 0) / maxScore) * 100);

            return (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-5 text-right font-mono tabular-nums">
                  {i + 1}
                </span>
                <span
                  className="text-sm font-bold w-24 shrink-0 truncate"
                  style={{ color }}
                >
                  {name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-gray-400 shrink-0">
                  {avgScore}
                </span>
                <span className="text-xs text-gray-600 shrink-0 hidden sm:inline">
                  · {classAvgIlvl} ilvl · {cls._count.id} {t("players")}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top Players — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {/* Top M+ Players */}
        <section className="glass rounded-3xl p-6 border border-white/5">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6">
            {t("topMplus")}
          </h2>
          <div className="space-y-3">
            {topMPlus.slice(0, 10).map((p, i) => (
              <div key={`${p.characterName}-${p.realm}`} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold border ${
                    i === 0
                      ? "bg-violet-500 border-violet-400 text-white"
                      : "bg-white/5 border-white/10 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}
                  >
                    {p.characterName}
                  </p>
                  <Link
                    href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[11px] text-gray-500 hover:text-white transition-colors truncate block"
                  >
                    {p.guild.name}
                  </Link>
                </div>
                <span className="text-sm font-mono tabular-nums font-bold shrink-0">
                  {p.mythicPlusScore}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Top Solo Shuffle */}
        <section className="glass rounded-3xl p-6 border border-white/5">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6">
            {t("topSoloShuffle")}
          </h2>
          <div className="space-y-3">
            {topPvp.slice(0, 10).map((p, i) => (
              <div key={`${p.characterName}-${p.realm}`} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold border ${
                    i === 0
                      ? "bg-violet-500 border-violet-400 text-white"
                      : "bg-white/5 border-white/10 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}
                  >
                    {p.characterName}
                  </p>
                  <Link
                    href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[11px] text-gray-500 hover:text-white transition-colors truncate block"
                  >
                    {p.guild.name}
                  </Link>
                </div>
                <span className="text-sm font-mono tabular-nums font-bold shrink-0">
                  {p.soloShuffleRating}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-xs text-gray-600">
        {t("dataNote")}
      </p>
    </div>
  );
}
