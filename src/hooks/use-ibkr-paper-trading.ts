"use client";

import { useQuery } from "@tanstack/react-query";

export interface IbkrTradeSetup {
  entryHi: number | null;
  stopLoss: number | null;
  target1: number | null;
  timeframe: string | null;
  confidence: string | null;
  riskReward: string | null;
}

export interface IbkrTrade {
  symbol: string;
  name: string | null;
  aiScore: number | null;
  stage: string | null;
  recommendation: string | null;
  catalyst: string | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  returnPct: number | null;
  pnl: number | null;
  unrealizedPnl: number | null;
  realizedPnl: number;
  holdDays: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  tradeSetup: IbkrTradeSetup | null;
}

export interface IbkrSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  tradesWithMark: number;
  winRate: number;
  avgReturn: number;
  totalPnl: number;
  positionSize: number;
}

export interface IbkrBenchmark {
  symbol: string;
  returnPct: number | null;
  matchedReturnPct: number | null;
  windowStart: string;
  windowEnd: string;
}

export interface IbkrAccount {
  equity: number;
  cash: number;
  currency: string;
  buyingPower: number;
  longMarketValue: number;
  lastEquity: number;
  dayTradeCount: number;
  tradingBlocked: boolean;
}

export interface IbkrPortfolioPoint {
  timestamp: number;
  equity: number;
}

export interface IbkrPortfolioHistory {
  points: IbkrPortfolioPoint[];
  baseValue: number;
}

export interface IbkrPaperData {
  summary: IbkrSummary;
  trades: IbkrTrade[];
  benchmark: IbkrBenchmark;
  account: IbkrAccount | null;
  portfolioHistory: IbkrPortfolioHistory | null;
  isLive: boolean;
}

export function useIbkrPaperTrades() {
  return useQuery<IbkrPaperData>({
    queryKey: ["ibkr-paper-trades"],
    queryFn: async () => {
      const res = await fetch("/api/paper-trading/ibkr");
      if (!res.ok) throw new Error("Failed to fetch IBKR paper trades");
      return res.json();
    },
    staleTime: 60 * 1000, // 60s — matches server-side Alpaca position cache
    refetchOnWindowFocus: false,
  });
}
