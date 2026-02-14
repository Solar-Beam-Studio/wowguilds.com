"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { AppLogo } from "@/components/app-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/stats", label: "Stats" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
] as const;

export function Header({ className }: { className?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0b0b0d]/80 backdrop-blur-xl ${className ?? ""}`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 md:px-6">
          <AppLogo href="/" mode="full" />

          {/* Desktop nav — left, next to logo */}
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Right side — language switcher */}
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -mr-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[#0b0b0d]/95 backdrop-blur-xl md:hidden">
          <div className="pt-20 px-6 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 text-lg font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 px-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
