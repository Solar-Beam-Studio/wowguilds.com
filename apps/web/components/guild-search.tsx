"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";

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

export function GuildSearch() {
  const t = useTranslations("home");
  const router = useRouter();

  const [guildName, setGuildName] = useState("");
  const [realm, setRealm] = useState("");
  const [region, setRegion] = useState("eu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Realm autocomplete
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmOpen, setRealmOpen] = useState(false);
  const [realmFiltered, setRealmFiltered] = useState<Realm[]>([]);
  const realmRef = useRef<HTMLDivElement>(null);

  // Guild suggestions
  const [suggestions, setSuggestions] = useState<GuildSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectRealm(r: Realm) {
    setRealm(r.slug);
    setRealmOpen(false);
  }

  function selectSuggestion(g: GuildSuggestion) {
    setSuggestionsOpen(false);
    router.push(`/g/${g.id}`);
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
      router.push(`/g/${guild.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 w-full max-w-xl relative">
      <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl px-4 h-14 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/50 transition-all shadow-sm hover:shadow-md">
        <Search className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />

        {/* Guild name input + suggestions */}
        <div ref={suggestionsRef} className="flex-1 relative min-w-0">
          <input
            type="text"
            value={guildName}
            onChange={(e) => {
              setGuildName(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            placeholder={t("guildNamePlaceholder")}
            className="w-full bg-transparent text-sm focus:outline-none font-medium"
            required
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-3 w-72 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
              {suggestions.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectSuggestion(g)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{g.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {g.realm} — {g.region.toUpperCase()}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0 ml-3">
                    {g.memberCount} members
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Realm input + autocomplete */}
        <div ref={realmRef} className="flex-1 relative min-w-0">
          <input
            type="text"
            value={realm}
            onChange={(e) => {
              setRealm(e.target.value);
              setRealmOpen(true);
            }}
            onFocus={() => setRealmOpen(true)}
            placeholder={t("realmPlaceholder")}
            className="w-full bg-transparent text-sm focus:outline-none font-medium"
            required
          />
          {realmOpen && realmFiltered.length > 0 && (
            <div className="absolute left-0 top-full mt-3 w-56 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
              {realmFiltered.map((r) => (
                <button
                  key={r.slug}
                  type="button"
                  onClick={() => selectRealm(r)}
                  className={`w-full text-left px-4 py-2 hover:bg-[var(--bg-tertiary)] transition-colors ${
                    r.slug === realm ? "bg-[var(--bg-tertiary)] text-accent" : ""
                  }`}
                >
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{r.slug}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Region select */}
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="bg-transparent text-sm focus:outline-none font-bold text-[var(--text-secondary)] w-12 cursor-pointer"
        >
          <option value="eu">EU</option>
          <option value="us">US</option>
          <option value="kr">KR</option>
          <option value="tw">TW</option>
          <option value="cn">CN</option>
        </select>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-8 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-accent/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {t("searchButton")}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs font-medium mt-3 text-center">{error}</p>
      )}
    </form>
  );
}
