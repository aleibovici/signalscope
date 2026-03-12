"use client";

import { useQuery } from "@tanstack/react-query";

export interface ScanSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  signalCount: number;
  validatedCount: number;
  filteredCount: number;
}

export interface ValidatedTickerData {
  id: string;
  symbol: string;
  name?: string | null;
  price: number | null;
  marketCap: number | null;
  sector?: string | null;
  catalyst: string | null;
  risks: string | null;
  recommendation: string | null;
  report: string | null;
  aiScore: number;
  stage: string;
  signalCount: number;
  sourceCount: number;
  sources: string[];
  shortFloat: number | null;
  avgSentiment: number | null;
  firstSeenDaysAgo: number | null;
  priorAppearances: number;
  return1d?: number | null;
  return3d?: number | null;
  return7d: number | null;
  return30d?: number | null;
  exchange: string | null;
  wk52Lo: number | null;
  wk52Hi: number | null;
  pndFlagged?: boolean;
  pndScore?: number;
  pndFlags?: string[];
  subredditCount?: number | null;
  createdAt: string;
}

export interface SignalData {
  id: string;
  symbol: string;
  source: string;
  title: string | null;
  url: string | null;
  upvotes: number | null;
  commentCount: number | null;
  sentiment: string | null;
  pndFlagged: boolean;
  pndFlags: string[];
  pndScore: number;
  createdAt: string;
}

export interface ScansFilter {
  status?: string;
  from?: string;
  to?: string;
}

export function useScans(page = 1, limit = 10, filters?: ScansFilter) {
  return useQuery<{ scans: ScanSummary[]; total: number }>({
    queryKey: ["scans", page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters?.status) params.set("status", filters.status);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      const res = await fetch(`/api/scans?${params}`);
      if (!res.ok) throw new Error("Failed to fetch scans");
      return res.json();
    },
  });
}

export function useScanDetail(scanId: string | null, includeFiltered = false) {
  return useQuery<{ scan: ScanSummary; tickers: ValidatedTickerData[] }>({
    queryKey: ["scan", scanId, includeFiltered],
    queryFn: async () => {
      const url = includeFiltered
        ? `/api/scans/${scanId}?includeFiltered=true`
        : `/api/scans/${scanId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch scan detail");
      return res.json();
    },
    enabled: !!scanId,
  });
}

export function useSignals(scanId: string | null, stage?: string) {
  return useQuery<{ signals: SignalData[] }>({
    queryKey: ["signals", scanId, stage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scanId) params.set("scanId", scanId);
      if (stage) params.set("stage", stage);
      const res = await fetch(`/api/signals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      return res.json();
    },
    enabled: !!scanId,
  });
}

export interface TickerHistoryEntry {
  scanId: string;
  startedAt: string;
  aiScore: number;
  stage: string;
  price: number | null;
  signalCount: number;
  sourceCount: number;
  recommendation: string | null;
}

export function useTickerHistory(symbol: string | null) {
  return useQuery<{ history: TickerHistoryEntry[] }>({
    queryKey: ["ticker-history", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/tickers/${symbol}/history`);
      if (!res.ok) throw new Error("Failed to fetch ticker history");
      return res.json();
    },
    enabled: !!symbol,
  });
}

export function useTickerDetail(symbol: string | null) {
  return useQuery<{ ticker: ValidatedTickerData; signals: SignalData[] }>({
    queryKey: ["ticker", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/tickers/${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch ticker");
      return res.json();
    },
    enabled: !!symbol,
  });
}
