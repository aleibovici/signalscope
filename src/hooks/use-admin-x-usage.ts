"use client";

import { useQuery } from "@tanstack/react-query";

export interface XApiActionBreakdown {
  action: string;
  calls: number;
  rows: number;
}

export interface XApiEndpointBreakdown {
  endpoint: string;
  calls: number;
  rows: number;
}

export interface XApiLogEntry {
  id: string;
  createdAt: string;
  endpoint: string;
  method: string;
  action: string;
  count: number;
  statusCode: number | null;
}

export interface AdminXUsage {
  totals: {
    allTime: { calls: number; rows: number };
    last24h: { calls: number; rows: number };
    last7d: { calls: number; rows: number };
    last30d: { calls: number; rows: number };
  };
  byAction: XApiActionBreakdown[];
  byEndpoint: XApiEndpointBreakdown[];
  errors7d: number;
  recentLogs: XApiLogEntry[];
}

export function useAdminXUsage() {
  return useQuery<AdminXUsage>({
    queryKey: ["admin-x-usage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/x-usage");
      if (!res.ok) throw new Error("Failed to fetch X API usage");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
