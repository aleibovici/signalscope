"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ShareRewardStatus {
  claimed: boolean;
  claimedAt: string | null;
  tweetIntentUrl: string;
  hasActiveSubscription: boolean;
}

export function useShareReward(enabled = true) {
  return useQuery<ShareRewardStatus>({
    queryKey: ["share-reward"],
    queryFn: async () => {
      const res = await fetch("/api/user/share-reward");
      if (!res.ok) throw new Error("Failed to fetch share reward status");
      return res.json();
    },
    enabled,
  });
}

export function useClaimShareReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tweetUrl: string) => {
      const res = await fetch("/api/user/share-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to claim reward");
      return data as { success: boolean; rewardType: "trial" | "credit" };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share-reward"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
