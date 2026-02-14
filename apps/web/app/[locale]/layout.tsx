import type { Metadata } from "next";
import { Inter, Rajdhani, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });
const rajdhani = Rajdhani({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL("https://wowguilds.com"),
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    robots: { index: true, follow: true },
    icons: { icon: "/icon.svg" },
    openGraph: {
      type: "website",
      siteName: "WoW Guilds",
      locale,
      images: [{ url: "/hero.webp", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      languages: {
        en: "/",
        fr: "/fr",
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className="dark">
      <head>
        <script
          defer
          src="https://api.pirsch.io/pa.js"
          id="pianjs"
          data-code="iu73lSPBGtclASDIfg6NTS5pOf4t4TFl"
        />
      </head>
      <body className={`${inter.className} ${rajdhani.variable} ${jetbrainsMono.variable} min-h-screen bg-[#0b0b0d] text-white antialiased`}>
        {/* Background image — visible at top, fades to solid at bottom */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src="/hero.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,11,13,0.7) 0%, rgba(11,11,13,0.92) 30%, rgba(11,11,13,1) 50%)" }} />
        </div>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {children}
            <Toaster theme="dark" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
