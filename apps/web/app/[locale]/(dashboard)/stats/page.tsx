import { prisma } from "@wow/database";
import { CLASS_COLORS } from "@wow/database";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Trophy, Users, Shield, Sword, Activity, TrendingUp, Globe, Zap } from "lucide-react";

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

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass = "text-white",
}: {
  label: string;
  value: string | number;
  icon: any;
  colorClass?: string;
}) {
  return (
    <div className="glass rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center group hover:border-white/10 transition-all">
      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className={`text-3xl font-mono tabular-nums font-bold ${colorClass}`}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mt-2">
        {label}
      </p>
    </div>
  );
}

function ClassBar({ 
  name, 
  rank, 
  avgScore, 
  count, 
  maxScore, 
  color, 
  avgIlvl,
  playersLabel
}: { 
  name: string; 
  rank: number; 
  avgScore: number; 
  count: number; 
  maxScore: number; 
  color: string; 
  avgIlvl: number;
  playersLabel: string;
}) {
  const pct = Math.round((avgScore / maxScore) * 100);
  
  return (
    <div className="group">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[10px] font-mono font-bold text-gray-600 w-5 text-right tabular-nums">
          {rank}
        </span>
        <span className="text-[13px] font-bold shrink-0 truncate w-24" style={{ color }}>
          {name}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-[13px] font-mono font-bold text-white w-12 text-right tabular-nums">
          {avgScore}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-32 text-[10px] font-bold uppercase tracking-wider text-gray-600">
        <span>{avgIlvl} iLvl</span>
        <span className="opacity-30">•</span>
        <span>{count} {playersLabel}</span>
      </div>
    </div>
  );
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
  const activePct = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-12 md:py-20 animate-in fade-in duration-1000">
      <div className="mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest mb-6">
          <Activity className="w-3 h-3" />
          {t("liveData")}
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 leading-[0.9]">
          {t("title")}
        </h1>
        <p className="text-gray-500 text-lg font-medium max-w-2xl">
          {t("description", {
            members: totalMembers.toLocaleString(),
            guilds: totalGuilds,
          })}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <KpiCard label={t("guildsTracked")} value={totalGuilds} icon={Globe} colorClass="text-blue-400" />
        <KpiCard label={t("totalCharacters")} value={totalMembers.toLocaleString()} icon={Users} colorClass="text-white" />
        <KpiCard label={t("activeCharacters")} value={`${activePct}%`} icon={Zap} colorClass="text-green-400" />
        <KpiCard label={t("avgItemLevel")} value={avgIlvl} icon={Shield} colorClass="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
        {/* Class M+ Rankings */}
        <section className="lg:col-span-2 glass rounded-[2.5rem] p-8 md:p-10 border border-white/5 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{t("classMplusRankings")}</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{t("globalAvgScore")}</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {classStats.map((cls, i) => {
              const name = cls.characterClass!;
              const maxScore = classStats[0]?._avg.mythicPlusScore || 1;
              return (
                <ClassBar
                  key={name}
                  rank={i + 1}
                  name={name}
                  avgScore={Math.round(cls._avg.mythicPlusScore || 0)}
                  count={cls._count.id}
                  maxScore={maxScore}
                  color={CLASS_COLORS[name] || "#888"}
                  avgIlvl={Math.round((cls._avg.itemLevel || 0) * 10) / 10}
                  playersLabel={t("players")}
                />
              );
            })}
          </div>

          <div className="absolute -right-20 -bottom-20 opacity-[0.02] pointer-events-none">
            <TrendingUp className="w-96 h-96" />
          </div>
        </section>

        {/* Hall of Fame / Top Lists */}
        <div className="space-y-12">
          {/* Top M+ Players */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-orange-400" />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{t("topMplus")}</h2>
            </div>
            <div className="space-y-4">
              {topMPlus.slice(0, 5).map((p, i) => (
                <div key={`${p.characterName}-${p.realm}`} className="flex items-center gap-3 group">
                  <div className="text-[10px] font-mono font-bold text-gray-700 w-4">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}>
                      {p.characterName}
                    </p>
                    <Link
                      href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-white transition-colors truncate block mt-0.5"
                    >
                      {p.guild.name}
                    </Link>
                  </div>
                  <div className="text-sm font-mono font-black italic tracking-tighter text-white">
                    {p.mythicPlusScore}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top Solo Shuffle */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Sword className="w-4 h-4 text-red-400" />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{t("topSoloShuffle")}</h2>
            </div>
            <div className="space-y-4">
              {topPvp.slice(0, 5).map((p, i) => (
                <div key={`${p.characterName}-${p.realm}`} className="flex items-center gap-3 group">
                  <div className="text-[10px] font-mono font-bold text-gray-700 w-4">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: CLASS_COLORS[p.characterClass || ""] || "#888" }}>
                      {p.characterName}
                    </p>
                    <Link
                      href={`/g/${p.guild.region}/${p.guild.realm}/${p.guild.name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-white transition-colors truncate block mt-0.5"
                    >
                      {p.guild.name}
                    </Link>
                  </div>
                  <div className="text-sm font-mono font-black italic tracking-tighter text-white">
                    {p.soloShuffleRating}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 italic">
          {t("dataNote")}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">{t("home")}</Link>
          <Link href="/guides" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">{t("guides")}</Link>
        </div>
      </div>
    </div>
  );
}
