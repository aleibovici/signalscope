"use client";

import { useQuery } from "@tanstack/react-query";

export interface AdminStats {
  users: {
    total: number;
    new7d: number;
    new30d: number;
    emailAlerts: number;
    withApiKey: number;
    proSubscribers: number;
    churned: number;
  };
  scans: {
    completed: number;
    failed: number;
    lastScan: {
      startedAt: string;
      validatedCount: number | null;
      signalCount: number | null;
    } | null;
    totalAiCost: number;
  };
  tickers: {
    total: number;
    byStage: Record<string, number>;
    pndFlagged: number;
  };
  signals: {
    total: number;
    bySource: Record<string, number>;
  };
  engagement: {
    openPositions: number;
    closedPositions: number;
    watchlistEntries: number;
  };
  system: {
    activeSessions: number;
    activeApiKeys: number;
  };
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
