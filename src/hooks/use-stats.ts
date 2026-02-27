"use client";

import { useQuery } from "@tanstack/react-query";

export interface PlatformStats {
  users: number;
  scans: number;
  signals: number;
  tickers: number;
  totalAiCost: number;
}

export function useStats() {
  return useQuery<PlatformStats>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
