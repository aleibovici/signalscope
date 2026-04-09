"use client";

import { useQuery, useQueries } from "@tanstack/react-query";

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
  matchedReturnPct: number | null;
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
  lookbackDays: number;
}

async function fetchPaperTrades(minScore: number, lookbackDays: number): Promise<PaperTradingData> {
  const params = new URLSearchParams();
  params.set("minScore", String(minScore));
  params.set("lookbackDays", String(lookbackDays));
  const res = await fetch(`/api/paper-trading?${params}`);
  if (!res.ok) throw new Error("Failed to fetch paper trades");
  return res.json();
}

export function usePaperTrades(filters: PaperTradingFilters) {
  return useQuery<PaperTradingData>({
    queryKey: ["paper-trading", filters.minScore, filters.lookbackDays],
    queryFn: () => fetchPaperTrades(filters.minScore, filters.lookbackDays),
    staleTime: 5 * 60 * 1000,
  });
}

export interface AlphaPoint {
  days: number;
  label: string;
  avgReturn: number | null;
  spyReturn: number | null;
  totalPnl: number;
  spyTotalPnl: number;
  trades: number;
}

const ALPHA_PERIODS = [
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
];

export function useAlphaCurve(minScore: number) {
  const results = useQueries({
    queries: ALPHA_PERIODS.map((p) => ({
      queryKey: ["paper-trading", minScore, p.days],
      queryFn: () => fetchPaperTrades(minScore, p.days),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  const points: AlphaPoint[] = ALPHA_PERIODS.map((p, i) => {
    const d = results[i].data;
    if (!d) return { days: p.days, label: p.label, avgReturn: null, spyReturn: null, totalPnl: 0, spyTotalPnl: 0, trades: 0 };

    // Compute SPY total PnL from per-trade matched SPY returns
    const posSize = d.summary.positionSize;
    const spyTotalPnl = (d.trades as (PaperTrade & { spyReturnPct?: number | null })[])
      .filter((t) => t.spyReturnPct != null && t.returnPct != null)
      .reduce((sum, t) => sum + posSize * (t.spyReturnPct ?? 0), 0);

    return {
      days: p.days,
      label: p.label,
      avgReturn: d.summary.tradesWithMark > 0 ? d.summary.avgReturn : null,
      spyReturn: d.benchmark.matchedReturnPct,
      totalPnl: d.summary.totalPnl,
      spyTotalPnl,
      trades: d.summary.totalTrades,
    };
  });

  return { points, isLoading };
}
