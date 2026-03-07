"use client";

import { useQuery } from "@tanstack/react-query";
import type { ValidatedTickerData } from "@/hooks/use-scans";

export interface TrendingTicker extends ValidatedTickerData {
  appearanceCount: number;
  trend: "rising" | "falling" | "stable";
  scoreTrajectory: { score: number; stage: string; date: string }[];
}

export interface TrendingSummary {
  totalTrending: number;
  risingCount: number;
  fallingCount: number;
  stableCount: number;
  avgScore: number;
}

export interface TrendingFilters {
  minAppearances?: number;
  stage?: string;
  trend?: string;
}

export function useTrendingTickers(page = 1, limit = 12, filters?: TrendingFilters) {
  return useQuery<{ tickers: TrendingTicker[]; total: number; summary: TrendingSummary }>({
    queryKey: ["trending", page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters?.minAppearances) params.set("minAppearances", String(filters.minAppearances));
      if (filters?.stage) params.set("stage", filters.stage);
      if (filters?.trend) params.set("trend", filters.trend);
      const res = await fetch(`/api/tickers/trending?${params}`);
      if (!res.ok) throw new Error("Failed to fetch trending tickers");
      return res.json();
    },
  });
}
