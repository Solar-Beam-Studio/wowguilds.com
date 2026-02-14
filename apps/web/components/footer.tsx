"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="relative z-10 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-black tracking-tighter uppercase">
            WOW<span className="text-violet-500">GUILDS</span>.COM
          </Link>
          <span className="text-[10px] text-gray-600">
            &copy; {new Date().getFullYear()} {t("copyright")}
          </span>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-gray-500">
          <Link
            href="/faq"
            className="hover:text-white transition-colors"
          >
            FAQ
          </Link>
          <span className="text-gray-700">
            {t("notAffiliated")}
          </span>
        </div>
      </div>
    </footer>
  );
}
