"use client";

import { Link } from "@/i18n/navigation";
import { AppLogo } from "@/components/app-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Footer } from "@/components/footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-white relative z-10">
      <header className="w-full px-8 py-5 flex items-center justify-between">
        <AppLogo href="/" mode="full" />
        <div className="flex items-center gap-6">
          <Link href="/guides" className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider">
            Guides
          </Link>
          <Link href="/faq" className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider">
            FAQ
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      {children}
      <Footer />
    </div>
  );
}
