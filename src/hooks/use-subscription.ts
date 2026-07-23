"use client";

import { useMutation } from "@tanstack/react-query";

export function useCheckout() {
  return useMutation({
    mutationFn: async (period: "monthly" | "yearly") => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create checkout session");
      return data as { url: string };
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create portal session");
      return data as { url: string };
    },
  });
}
