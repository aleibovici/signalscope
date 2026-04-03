"use client";

import { useQuery } from "@tanstack/react-query";

export interface PaperTrade {
  symbol: string;
  name: string | null;
  aiScore: number;
  opportunityScore: number;
  stage: string;
  catalyst: string | null;
  entryPrice: number;
  exitPrice: number | null;
  returnPct: number | null;
  pnl: number | null;
  holdDays: string | null;
  status: "OPEN" | "CLOSED";
  detectedAt: string;
  detectedAtMs: number;
  closingAt: string | null;
  closingAtMs: number | null;
}

export interface PaperTradingSummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  tradesWithMark: number;
  winRate: number;
  avgReturn: number;
  totalPnl: number;
  avgHoldDays: number | null;
  positionSize: number;
}

export interface PaperTradingBenchmark {
  symbol: string;
  returnPct: number | null;
  windowStart: string;
  windowEnd: string;
}

export interface PaperTradingData {
  summary: PaperTradingSummary;
  trades: PaperTrade[];
  benchmark: PaperTradingBenchmark;
}

export interface PaperTradingFilters {
  minScore: number;
}

export function usePaperTrades(filters: PaperTradingFilters) {
  return useQuery<PaperTradingData>({
    queryKey: ["paper-trading", filters.minScore],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("minScore", String(filters.minScore));
      const res = await fetch(`/api/paper-trading?${params}`);
      if (!res.ok) throw new Error("Failed to fetch paper trades");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
