"use client";

import { useQuery } from "@tanstack/react-query";

export interface RelatedTicker {
  symbol: string;
  name: string | null;
  coOccurrenceCount: number;
  correlationScore: number;
  latestAiScore: number;
  latestStage: string;
  sector: string | null;
  sources: string[];
  price: number | null;
  marketCap: number | null;
  recommendation: string | null;
}

export interface RelatedTickersResponse {
  relatedTickers: RelatedTicker[];
  targetSymbol: string;
  targetScanCount: number;
  total: number;
}

export function useRelatedTickers(symbol: string, limit = 6) {
  return useQuery<RelatedTickersResponse>({
    queryKey: ["related", symbol, limit],
    enabled: !!symbol,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      const res = await fetch(`/api/tickers/${encodeURIComponent(symbol)}/related?${params}`);
      if (!res.ok) throw new Error("Failed to fetch related tickers");
      return res.json();
    },
  });
}
