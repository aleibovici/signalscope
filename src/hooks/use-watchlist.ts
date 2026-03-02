"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ValidatedTickerData } from "@/hooks/use-scans";

interface WatchlistEntry {
  symbol: string;
  createdAt: string;
}

export function useWatchlist() {
  return useQuery<{ watchlist: WatchlistEntry[] }, Error, Set<string>>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      return res.json();
    },
    select: (data) => new Set(data.watchlist.map((e) => e.symbol)),
    staleTime: 60_000,
  });
}

export function useToggleWatchlist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ symbol, isBookmarked }: { symbol: string; isBookmarked: boolean }) => {
      const res = await fetch(
        isBookmarked ? `/api/watchlist/${symbol}` : "/api/watchlist",
        isBookmarked
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ symbol }),
            }
      );
      if (!res.ok && res.status !== 404) throw new Error("Failed to update watchlist");
      return res.json();
    },
    onMutate: async ({ symbol, isBookmarked }) => {
      await qc.cancelQueries({ queryKey: ["watchlist"] });
      const previous = qc.getQueryData<{ watchlist: WatchlistEntry[] }>(["watchlist"]);

      qc.setQueryData<{ watchlist: WatchlistEntry[] }>(["watchlist"], (old) => {
        if (!old) return old;
        if (isBookmarked) {
          return { watchlist: old.watchlist.filter((e) => e.symbol !== symbol) };
        } else {
          return {
            watchlist: [{ symbol, createdAt: new Date().toISOString() }, ...old.watchlist],
          };
        }
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["watchlist"], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      qc.invalidateQueries({ queryKey: ["watchlist-tickers"] });
    },
  });
}

export function useWatchlistTickers() {
  return useQuery<{ tickers: ValidatedTickerData[] }>({
    queryKey: ["watchlist-tickers"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist/tickers");
      if (!res.ok) throw new Error("Failed to fetch watchlist tickers");
      return res.json();
    },
    staleTime: 60_000,
  });
}
