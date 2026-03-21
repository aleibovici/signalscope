"use client";

import { useQuery } from "@tanstack/react-query";

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  emailAlerts: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  _count: {
    positions: number;
    watchlist: number;
    apiKeys: number;
  };
}

export function useAdminUsers() {
  return useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch admin users");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
