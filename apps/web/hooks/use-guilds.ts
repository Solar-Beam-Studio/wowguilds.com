"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Guild {
  id: string;
  name: string;
  realm: string;
  region: string;
  syncEnabled: boolean;
  discoveryIntervalHours: number;
  activeSyncIntervalMin: number;
  activityWindowDays: number;
  memberCount: number;
  lastDiscoveryAt: string | null;
  lastActiveSyncAt: string | null;
  createdAt: string;
  _count?: { members: number };
}

export function useGuilds() {
  return useQuery<Guild[]>({
    queryKey: ["guilds"],
    queryFn: async () => {
      const res = await fetch("/api/guilds");
      if (!res.ok) throw new Error("Failed to fetch guilds");
      return res.json();
    },
  });
}

export function useCreateGuild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      realm: string;
      region: string;
    }) => {
      const res = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create guild");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteGuild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guildId: string) => {
      const res = await fetch(`/api/guilds/${guildId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete guild");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
