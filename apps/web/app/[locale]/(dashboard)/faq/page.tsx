import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

const FAQ_KEYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const mt = await getTranslations({ locale, namespace: "meta" });

  return {
    title: mt("faqTitle"),
    description: mt("faqDescription"),
    alternates: {
      canonical: "/faq",
      languages: { en: "/faq", fr: "/fr/faq" },
    },
    openGraph: {
      title: mt("faqTitle"),
      description: mt("faqDescription"),
    },
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("faq");

  const items = FAQ_KEYS.map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));

  // Safe: all content comes from our own translation files, not user input
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  });

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://wowguilds.com" },
      { "@type": "ListItem", position: 2, name: "FAQ", item: "https://wowguilds.com/faq" },
    ],
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-6 md:px-8 py-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">
        {t("title")}
      </h1>
      <p className="text-gray-500 text-sm font-bold tracking-wide mb-12">
        {t("description")}
      </p>

      <div className="space-y-8">
        {items.map((item, i) => (
          <div key={i} className="border-b border-white/5 pb-8 last:border-0">
            <h2 className="text-lg font-bold text-white mb-2">{item.question}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
