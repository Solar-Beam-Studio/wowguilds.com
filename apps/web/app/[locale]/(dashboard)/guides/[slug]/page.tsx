import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@wow/database";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;

  const [guide, translations] = await Promise.all([
    prisma.guide.findUnique({
      where: { slug_locale: { slug, locale } },
      select: { metaTitle: true, metaDescription: true, slug: true },
    }),
    prisma.guide.findMany({
      where: { slug, status: "published" },
      select: { locale: true },
    }),
  ]);

  if (!guide) return {};

  const languages: Record<string, string> = {};
  for (const t of translations) {
    const prefix = t.locale === "en" ? "" : `/${t.locale}`;
    languages[t.locale] = `${prefix}/guides/${guide.slug}`;
  }

  return {
    title: guide.metaTitle || guide.slug,
    description: guide.metaDescription,
    alternates: {
      canonical: `/guides/${guide.slug}`,
      languages,
    },
    openGraph: {
      title: guide.metaTitle || undefined,
      description: guide.metaDescription || undefined,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const guide = await prisma.guide.findUnique({
    where: { slug_locale: { slug, locale } },
  });

  if (!guide || guide.status !== "published") {
    notFound();
  }

  const t = await getTranslations("guides");

  // Content is AI-generated and stored in our own DB (not user-submitted).
  // The markdown renderer (marked) converts to HTML from trusted content.
  const html = renderMarkdown(guide.content);

  // JSON-LD structured data — all values from our DB, safe for serialization
  const articleJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.metaTitle || guide.title,
    description: guide.metaDescription,
    datePublished: guide.publishedAt?.toISOString(),
    dateModified: guide.updatedAt.toISOString(),
    publisher: {
      "@type": "Organization",
      name: "WoW Guilds",
      url: "https://wowguilds.com",
    },
  });

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://wowguilds.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("title"),
        item: "https://wowguilds.com/guides",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: `https://wowguilds.com/guides/${guide.slug}`,
      },
    ],
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-6 md:px-8 py-10 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />

      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
          <a href="/guides" className="hover:text-white transition-colors">
            {t("title")}
          </a>
          <span>/</span>
          <span className="text-gray-500">{guide.title}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
          {guide.title}
        </h1>

        {guide.publishedAt && (
          <p className="text-xs text-gray-600">
            {new Date(guide.publishedAt).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" · "}
            {guide.wordCount} {t("words")}
          </p>
        )}
      </div>

      {/* Content is AI-generated from our own pipeline, not user-submitted */}
      <article
        className="prose prose-invert prose-sm max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-gray-300 prose-p:leading-relaxed
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white
          prose-li:text-gray-300
          prose-code:text-orange-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
