"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";

interface ApiKeyMeta {
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeyResponse {
  apiKey: ApiKeyMeta | null;
}

interface GenerateResponse {
  key: string;
  prefix: string;
}

export function useApiKey() {
  return useQuery<ApiKeyResponse>({
    queryKey: ["api-key"],
    queryFn: async () => {
      const res = await fetch("/api/user/api-key");
      if (!res.ok) throw new Error("Failed to fetch API key");
      return res.json();
    },
  });
}

export function useGenerateApiKey() {
  const qc = useQueryClient();
  return useMutation<GenerateResponse>({
    mutationFn: async () => {
      const res = await fetch("/api/user/api-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate API key");
      return data;
    },
    onSuccess: () => {
      trackEvent("generate_api_key");
      qc.invalidateQueries({ queryKey: ["api-key"] });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/api-key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to revoke API key");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-key"] });
    },
  });
}
