"use client";

import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareButton() {
  const t = useTranslations("guildDetail");

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        toast.success(t("linkCopied"));
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white border border-white/10 hover:border-white/20 transition-all"
    >
      <Share2 className="w-3 h-3" />
      {t("share")}
    </button>
  );
}
