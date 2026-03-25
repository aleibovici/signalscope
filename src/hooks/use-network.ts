"use client";

import { useQuery } from "@tanstack/react-query";

export interface NetworkNode {
  symbol: string;
  name: string | null;
  aiScore: number;
  opportunityScore: number;
  stage: string;
  price: number | null;
  marketCap: number | null;
  sector: string | null;
  recommendation: string | null;
  appearances: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  correlation: number;
  dataPoints: number;
}

export interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  centerSymbol: string | null;
}

export interface NetworkFilters {
  symbol?: string;
  minCorrelation?: number;
  stage?: string;
  days?: number;
  maxNodes?: number;
}

export function useTickerNetwork(filters?: NetworkFilters) {
  return useQuery<NetworkResponse>({
    queryKey: ["network", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.symbol) params.set("symbol", filters.symbol);
      if (filters?.minCorrelation) params.set("minCorrelation", String(filters.minCorrelation));
      if (filters?.stage) params.set("stage", filters.stage);
      if (filters?.days) params.set("days", String(filters.days));
      if (filters?.maxNodes) params.set("maxNodes", String(filters.maxNodes));
      const qs = params.toString();
      const res = await fetch(`/api/tickers/network${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch ticker network");
      return res.json();
    },
  });
}
