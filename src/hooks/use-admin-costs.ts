"use client";

import { useQuery } from "@tanstack/react-query";

export interface AiCostBreakdown {
  callPoint?: string;
  trigger?: string;
  cost: number;
  calls: number;
}

export interface AiScanCost {
  scanId: string;
  startedAt: string;
  scoring: number;
  pnd: number;
  report: number;
  total: number;
}

export interface AiOnDemandUser {
  userId: string | null;
  email: string;
  calls: number;
  cost: number;
}

export interface AdminCosts {
  totals: {
    allTime: { cost: number; calls: number; inputTokens: number; outputTokens: number };
    last7d: { cost: number; calls: number };
    last30d: { cost: number; calls: number };
  };
  byCallPoint: AiCostBreakdown[];
  byTrigger: AiCostBreakdown[];
  recentScans: AiScanCost[];
  onDemandByUser: AiOnDemandUser[];
}

export function useAdminCosts() {
  return useQuery<AdminCosts>({
    queryKey: ["admin-costs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/costs");
      if (!res.ok) throw new Error("Failed to fetch AI costs");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
