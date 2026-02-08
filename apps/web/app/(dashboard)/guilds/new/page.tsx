"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateGuild } from "@/hooks/use-guilds";
import { toast } from "sonner";

const REGIONS = [
  { value: "eu", label: "Europe" },
  { value: "us", label: "Americas" },
  { value: "kr", label: "Korea" },
  { value: "tw", label: "Taiwan" },
];

export default function NewGuildPage() {
  const router = useRouter();
  const createGuild = useCreateGuild();

  const [name, setName] = useState("");
  const [realm, setRealm] = useState("");
  const [region, setRegion] = useState("eu");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createGuild.mutate(
      { name, realm, region },
      {
        onSuccess: (guild) => {
          toast.success(`Guild "${name}" added! Discovery starting...`);
          router.push(`/g/${guild.id}`);
        },
      }
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-light tracking-tight mb-8">Add Guild</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">
            Guild Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pool Party"
            required
            className="w-full h-11 px-4 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">Realm</label>
          <input
            type="text"
            value={realm}
            onChange={(e) => setRealm(e.target.value)}
            placeholder="archimonde"
            required
            className="w-full h-11 px-4 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text)]"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Use the realm slug (lowercase, hyphens instead of spaces)
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full h-11 px-4 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text)]"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} ({r.value.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={createGuild.isPending}
          className="w-full h-11 bg-[var(--text)] text-[var(--bg)] hover:opacity-80 disabled:opacity-50 rounded-xl text-sm font-medium tracking-wide transition-opacity"
        >
          {createGuild.isPending ? "Adding guild..." : "Add Guild"}
        </button>
      </form>
    </div>
  );
}
