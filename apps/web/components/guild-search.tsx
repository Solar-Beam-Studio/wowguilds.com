"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Search, Loader2, X, History, ArrowRight, ChevronDown } from "lucide-react";
import { guildPath } from "@/lib/guild-url";

interface Realm {
  name: string;
  slug: string;
}

interface GuildSuggestion {
  id: string;
  name: string;
  realm: string;
  region: string;
  memberCount: number;
}

interface RecentSearch {
  id: string;
  name: string;
  realm: string;
  region: string;
}

export function GuildSearch() {
  const t = useTranslations("home");
  const router = useRouter();

  const [guildName, setGuildName] = useState("");
  const [realm, setRealm] = useState("");
  const [region, setRegion] = useState("eu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Region dropdown
  const [regionOpen, setRegionOpen] = useState(false);
  const regionBtnRef = useRef<HTMLButtonElement>(null);
  const [regionMenuPos, setRegionMenuPos] = useState({ top: 0, left: 0 });

  const regions = [
    { id: "eu", flag: "🇪🇺" },
    { id: "us", flag: "🇺🇸" },
    { id: "kr", flag: "🇰🇷" },
    { id: "tw", flag: "🇹🇼" },
    { id: "cn", flag: "🇨🇳" },
  ];

  const updateRegionMenuPos = () => {
    if (regionBtnRef.current) {
      const rect = regionBtnRef.current.getBoundingClientRect();
      setRegionMenuPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 160,
      });
    }
  };


  // Realm autocomplete
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmOpen, setRealmOpen] = useState(false);
  const [realmFiltered, setRealmFiltered] = useState<Realm[]>([]);
  const realmRef = useRef<HTMLDivElement>(null);
  const guildInputRef = useRef<HTMLInputElement>(null);

  // Guild suggestions
  const [suggestions, setSuggestions] = useState<GuildSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load recent searches
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("recent_guild_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const addToRecent = (guild: RecentSearch) => {
    const updated = [guild, ...recentSearches.filter(s => s.id !== guild.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recent_guild_searches", JSON.stringify(updated));
  };

  const removeRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s.id !== id);
    setRecentSearches(updated);
    localStorage.setItem("recent_guild_searches", JSON.stringify(updated));
  };

  useEffect(() => {
    if (regionOpen) {
      window.addEventListener("scroll", updateRegionMenuPos, true);
      window.addEventListener("resize", updateRegionMenuPos);
    }
    return () => {
      window.removeEventListener("scroll", updateRegionMenuPos, true);
      window.removeEventListener("resize", updateRegionMenuPos);
    };
  }, [regionOpen]);


  // Fetch realms when region changes
  useEffect(() => {
    fetch(`/api/realms?region=${region}`)
      .then((r) => r.json())
      .then((data: Realm[]) => setRealms(data))
      .catch(() => setRealms([]));
  }, [region]);

  // Filter realms as user types
  useEffect(() => {
    if (!realm) {
      setRealmFiltered(realms.slice(0, 8));
    } else {
      const q = realm.toLowerCase();
      setRealmFiltered(
        realms.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)).slice(0, 8)
      );
    }
  }, [realm, realms]);

  // Fetch guild suggestions (debounced)
  const fetchSuggestions = useCallback(
    (name: string, realmSlug: string, reg: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (name.length < 2) {
        setSuggestions([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ q: name, region: reg });
          if (realmSlug) params.set("realm", realmSlug);
          const res = await fetch(`/api/guilds/search?${params}`);
          const data: GuildSuggestion[] = await res.json();
          setSuggestions(data);
          setSuggestionsOpen(data.length > 0);
        } catch {
          setSuggestions([]);
        }
      }, 300);
    },
    []
  );

  useEffect(() => {
    fetchSuggestions(guildName, realm, region);
  }, [guildName, realm, region, fetchSuggestions]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (realmRef.current && !realmRef.current.contains(e.target as Node)) {
        setRealmOpen(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
      if (regionBtnRef.current && !regionBtnRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectRealm(r: Realm) {
    setRealm(r.slug);
    setRealmOpen(false);
  }

  function selectSuggestion(g: GuildSuggestion | RecentSearch) {
    setSuggestionsOpen(false);
    addToRecent({ id: g.id, name: g.name, realm: g.realm, region: g.region });
    router.push(guildPath(g));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildName.trim() || !realm.trim()) return;

    setLoading(true);
    setError("");
    setSuggestionsOpen(false);

    try {
      const res = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guildName.trim(),
          realm: realm.trim().toLowerCase(),
          region,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      const guild = await res.json();
      addToRecent({ id: guild.id, name: guild.name, realm: guild.realm, region: guild.region });
      router.push(guildPath(guild));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-12 w-full max-w-3xl relative">
      <form
        onSubmit={handleSubmit}
        className={`relative glass p-3 rounded-2xl md:rounded-[2.5rem] transition-all duration-300 ease-out ${
          isFocused ? "border-white/10 ring-4 ring-violet-500/10 shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)]" : "shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)]"
        }`}
        style={{ border: isFocused ? "1px solid rgba(255,255,255,0.1)" : undefined }}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-0">
          {/* Guild name input */}
          <div ref={suggestionsRef} className="flex-[1.5] min-w-0 px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Search className={`w-5 h-5 shrink-0 transition-colors duration-300 ${isFocused ? "text-violet-500" : "text-gray-500"}`} />
              <input
                ref={guildInputRef}
                type="text"
                value={guildName}
                onChange={(e) => {
                  setGuildName(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => {
                  setIsFocused(true);
                  setSuggestionsOpen(true);
                }}
                onBlur={() => setIsFocused(false)}
                placeholder={t("guildNamePlaceholder")}
                className="w-full bg-transparent text-base md:text-lg font-bold focus:outline-none placeholder:text-gray-600 placeholder:font-medium h-12"
                required
              />
            </div>
          </div>

          <div className="hidden md:block w-px h-8 bg-white/5 shrink-0" />
          <div className="md:hidden h-px w-full bg-white/5" />

          {/* Second row on mobile — md:contents makes this div invisible to desktop flex */}
          <div className="flex items-center md:contents min-w-0">
            {/* Realm input + autocomplete */}
            <div ref={realmRef} className="flex-1 relative min-w-0 px-4 md:px-6">
              <div className="flex items-center">
                <input
                  type="text"
                  value={realm}
                  onChange={(e) => {
                    setRealm(e.target.value);
                    setRealmOpen(true);
                  }}
                  onFocus={() => {
                    setRealmOpen(true);
                    setIsFocused(true);
                  }}
                  onBlur={() => setIsFocused(false)}
                  placeholder={t("realmPlaceholder")}
                  className="w-full bg-transparent text-sm font-bold focus:outline-none h-12 placeholder:font-medium placeholder:text-gray-600"
                  required
                />
              </div>
              {realmOpen && realmFiltered.length > 0 && (
                <div className="absolute left-0 top-[calc(100%+16px)] w-64 bg-[#111113] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden p-2 transition-all duration-200 ease-out">
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {realmFiltered.map((r) => (
                      <button
                        key={r.slug}
                        type="button"
                        onClick={() => selectRealm(r)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl transition-all ${
                          r.slug === realm
                            ? "bg-violet-600 text-white"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <p className="text-sm font-bold">{r.name}</p>
                        <p className={`text-[11px] font-medium ${r.slug === realm ? "text-white/70" : "text-gray-500"}`}>
                          {r.slug}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-white/5 shrink-0" />

            {/* Region select */}
            <div className="relative px-4 md:px-6">
              <button
                ref={regionBtnRef}
                type="button"
                onClick={() => {
                  updateRegionMenuPos();
                  setRegionOpen(!regionOpen);
                }}
                className="flex items-center gap-2 h-12 transition-all text-gray-400 hover:text-white"
              >
                <span className="text-base">{regions.find(r => r.id === region)?.flag}</span>
                <span className="text-xs font-black uppercase tracking-wider">{region}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${regionOpen ? "rotate-180" : ""}`} />
              </button>

              {mounted && regionOpen && createPortal(
                <div
                  className="fixed z-[9999] w-40 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  style={{ top: regionMenuPos.top, left: regionMenuPos.left }}
                >
                  <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 border-b border-white/5 mb-1">
                    {t("selectRegion")}
                  </div>
                  {regions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRegion(r.id);
                        setRegionOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group/reg ${
                        region === r.id
                          ? "bg-violet-600 text-white"
                          : "hover:bg-white/5 text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{r.flag}</span>
                        <span className="text-xs font-bold">{r.id.toUpperCase()}</span>
                      </div>
                      <span className={`text-[11px] font-black uppercase opacity-40 group-hover/reg:opacity-100 ${region === r.id ? "text-white opacity-100" : ""}`}>
                        {r.id}
                      </span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="h-12 px-6 md:px-10 bg-violet-600 hover:bg-violet-700 text-white rounded-[1.75rem] font-black text-[11px] uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-violet-600/20 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">{t("searchButton")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Suggestions dropdown — full width of search bar */}
      {(suggestionsOpen && (suggestions.length > 0 || (recentSearches.length > 0 && !guildName))) && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-[#111113] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden transition-all duration-200 ease-out">
          {!guildName && (
            <div className="p-2 border-b border-white/5 bg-white/[0.02]">
              <p className="px-3 py-1 text-[11px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <History className="w-3 h-3" />
                Recent Searches
              </p>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            {!guildName && recentSearches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="w-full text-left px-4 py-3 hover:bg-violet-600 hover:text-white rounded-2xl transition-all flex items-center justify-between group/item"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 group-hover/item:bg-white/20 flex items-center justify-center font-bold text-xs uppercase transition-colors">
                    {s.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{s.name}</p>
                    <p className="text-[11px] opacity-70 font-medium">
                      {s.realm} — {s.region.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover/item:opacity-100 transition-all translate-x-[-4px] group-hover/item:translate-x-0" />
                  {recentSearches.some(rs => rs.id === s.id) && (
                    <button
                      onClick={(e) => removeRecent(e, s.id)}
                      className="p-1.5 rounded-md hover:bg-black/10 text-white/50 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </button>
            ))}

            {guildName && suggestions.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => selectSuggestion(g)}
                className="w-full text-left px-4 py-3 hover:bg-violet-600 hover:text-white rounded-2xl transition-all flex items-center justify-between group/item"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 group-hover/item:bg-white/20 flex items-center justify-center font-bold text-xs uppercase transition-colors">
                    {g.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{g.name}</p>
                    <p className="text-[11px] opacity-70 font-medium truncate">
                      {g.realm} — {g.region.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-mono opacity-50 font-bold group-hover/item:opacity-80">
                    {g.memberCount} {t("chars")}
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover/item:opacity-100 transition-all translate-x-[-4px] group-hover/item:translate-x-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute left-0 right-0 -bottom-14 flex justify-center">
          <p className="bg-red-500/10 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold border border-red-500/20 shadow-lg backdrop-blur-md">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
