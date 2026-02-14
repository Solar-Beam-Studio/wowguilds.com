import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@wow/database";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guides" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/guides",
      languages: { en: "/guides", fr: "/fr/guides" },
    },
  };
}

const CATEGORY_KEYS: Record<string, string> = {
  "m-plus": "categoryMPlus",
  pvp: "categoryPvp",
  raids: "categoryRaids",
  general: "categoryGeneral",
  "class-guides": "categoryClassGuides",
};

export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("guides");

  const guides = await prisma.guide.findMany({
    where: { status: "published", locale },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      metaDescription: true,
      category: true,
      publishedAt: true,
      wordCount: true,
    },
  });

  // Group by category
  const grouped = guides.reduce(
    (acc, guide) => {
      const cat = guide.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(guide);
      return acc;
    },
    {} as Record<string, typeof guides>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-8 py-10 md:py-16">
      <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">
        {t("title")}
      </h1>
      <p className="text-gray-500 text-sm font-bold tracking-wide mb-12">
        {t("description")}
      </p>

      {guides.length === 0 ? (
        <p className="text-gray-500 text-sm">{t("noGuides")}</p>
      ) : (
        <div className="space-y-12">
          {Object.entries(grouped).map(([category, catGuides]) => (
            <section key={category}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
                {CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category}
              </h2>
              <div className="space-y-4">
                {catGuides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="block p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <h3 className="text-white font-bold mb-1">
                      {guide.title}
                    </h3>
                    {guide.metaDescription && (
                      <p className="text-gray-500 text-sm line-clamp-2">
                        {guide.metaDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                      {guide.publishedAt && (
                        <span>
                          {new Date(guide.publishedAt).toLocaleDateString(
                            locale,
                            { year: "numeric", month: "short", day: "numeric" }
                          )}
                        </span>
                      )}
                      <span>{guide.wordCount} {t("words")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
