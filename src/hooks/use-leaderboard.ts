"use client";

import { useQuery } from "@tanstack/react-query";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  gain3d: number | null;
  gain7d: number | null;
  gain30d: number | null;
  positionCount: number;
  winRate: number;
  bestSymbol: string;
  bestGainPct: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  pricesAsOf: string | null;
}

export function useLeaderboard(page = 1, limit = 20) {
  return useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}
