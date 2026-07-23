"use client";

import { useQuery } from "@tanstack/react-query";

export interface X402PaymentStats {
  total: number;
  allTimeRevenue: number;
  last7d: { count: number; revenue: number };
  last30d: { count: number; revenue: number };
  byEndpoint: {
    endpoint: string;
    count: number;
    amountUsd: string;
    revenue: number;
  }[];
  recentPayments: {
    id: string;
    endpoint: string;
    amountUsd: string;
    payerAddress: string | null;
    createdAt: string;
  }[];
}

export function useAdminPayments() {
  return useQuery<X402PaymentStats>({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payments");
      if (!res.ok) throw new Error("Failed to fetch payment stats");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
