"use client";

import { useQuery } from "@tanstack/react-query";
import type { ValidatedTickerData } from "@/hooks/use-scans";

export interface TrendingTicker extends ValidatedTickerData {
  appearanceCount: number;
  trend: "rising" | "falling" | "stable";
  scoreTrajectory: { score: number; stage: string; date: string }[];
  name: string | null;
  sector: string | null;
  pndFlagged: boolean;
  pndScore: number;
  pndFlags: string[];
  return1d: number | null;
  return3d: number | null;
  return30d: number | null;
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
  sector?: string;
  marketCap?: "micro" | "small" | "mid" | "large";
  sortBy?: "appearances" | "aiScore" | "price" | "return" | "marketCap";
  source?: string;
  hidePnd?: boolean;
  returnPeriod?: "1d" | "3d" | "7d" | "30d";
  near52wLow?: boolean;
}

export function useTrendingTickers(page = 1, limit = 12, filters?: TrendingFilters) {
  return useQuery<{ tickers: TrendingTicker[]; total: number; summary: TrendingSummary }>({
    queryKey: ["trending", page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters?.minAppearances) params.set("minAppearances", String(filters.minAppearances));
      if (filters?.stage) params.set("stage", filters.stage);
      if (filters?.trend) params.set("trend", filters.trend);
      if (filters?.sector) params.set("sector", filters.sector);
      if (filters?.marketCap) params.set("marketCap", filters.marketCap);
      if (filters?.sortBy) params.set("sortBy", filters.sortBy);
      if (filters?.source) params.set("source", filters.source);
      if (filters?.hidePnd) params.set("hidePnd", "true");
      if (filters?.returnPeriod) params.set("returnPeriod", filters.returnPeriod);
      if (filters?.near52wLow) params.set("near52wLow", "true");
      const res = await fetch(`/api/tickers/trending?${params}`);
      if (!res.ok) throw new Error("Failed to fetch trending tickers");
      return res.json();
    },
  });
}
