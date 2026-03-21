"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SubscriptionInfo {
  status: string;
  isActive: boolean;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  emailAlerts: boolean;
  subscription: SubscriptionInfo | null;
}

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

export function useUpdateUsername() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update username");
      return data as UserProfile;
    },
    onSuccess: (data) => {
      qc.setQueryData(["user-profile"], data);
    },
  });
}

export function useUpdateEmailAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emailAlerts: boolean) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAlerts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update email alerts");
      return data as UserProfile;
    },
    onSuccess: (data) => {
      qc.setQueryData(["user-profile"], data);
    },
  });
}
