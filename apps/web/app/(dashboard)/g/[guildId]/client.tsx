"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { MemberTable } from "@/components/member-table";
import type { GuildMember } from "@/hooks/use-members";

export function PublicGuildClient({
  members,
  region,
}: {
  members: GuildMember[];
  region: string;
}) {
  const [search, setSearch] = useState("");

  return (
    <>
      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="w-full h-10 pl-11 pr-4 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
        />
      </div>

      <MemberTable members={members} region={region} search={search} />
    </>
  );
}
