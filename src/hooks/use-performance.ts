"use client";

import { useQuery } from "@tanstack/react-query";

export interface TickerPerformanceData {
  id: string;
  symbol: string;
  detectionPrice: number;
  price1d: number | null;
  price3d: number | null;
  price7d: number | null;
  price30d: number | null;
  return1d: number | null;
  return3d: number | null;
  return7d: number | null;
  return30d: number | null;
  snapped1dAt: string | null;
  snapped3dAt: string | null;
  snapped7dAt: string | null;
  snapped30dAt: string | null;
  validatedTicker: {
    createdAt: string;
    aiScore: number;
    stage: string;
    scanId: string;
  };
}

export function useTickerPerformance(symbol: string | null) {
  return useQuery<{ latest: TickerPerformanceData | null; history: TickerPerformanceData[] }>({
    queryKey: ["ticker-performance", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/tickers/${symbol}/performance`);
      if (!res.ok) throw new Error("Failed to fetch ticker performance");
      return res.json();
    },
    enabled: !!symbol,
  });
}

export interface PerformanceStats {
  count: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
}

export interface PerformerEntry {
  symbol: string;
  return: number;
  aiScore: number;
  stage: string;
  detectionPrice: number;
  currentPrice: number;
  detectedAt: string;
}

export interface CohortStats {
  count: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
}

export interface CohortEntry {
  weekStart: string;
  weekLabel: string;
  count: number;
  stats: Record<string, CohortStats>;
  bestPick: { symbol: string; returnPct: number; horizon: string } | null;
}

export interface DailyReturnEntry {
  date: string;
  symbol: string;
  avgReturn: number;
  tradeCount: number;
  winCount: number;
}

export interface PerformanceSummary {
  totalTracked: number;
  current: PerformanceStats;
  prior: PerformanceStats;
}

export interface AggregatePerformance {
  summary: PerformanceSummary;
  cohorts: CohortEntry[];
  dailyReturns: DailyReturnEntry[];
  overall: PerformanceStats;
  confirmed: PerformanceStats;
  emerging: PerformanceStats;
  byStage: Record<string, PerformanceStats>;
  byType: Record<string, PerformanceStats>;
  byScoreRange: Record<string, PerformanceStats>;
  byOpportunityScoreRange: Record<string, PerformanceStats>;
  bestPerformers: PerformerEntry[];
  worstPerformers: PerformerEntry[];
}

export function useAggregatePerformance(days: number) {
  return useQuery<AggregatePerformance>({
    queryKey: ["aggregate-performance", days],
    queryFn: async () => {
      const res = await fetch(`/api/performance?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch aggregate performance");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
