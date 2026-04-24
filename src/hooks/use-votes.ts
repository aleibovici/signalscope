"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VoteAggregate } from "@/lib/votes";

export type { VoteAggregate };

type VoteMap = Record<string, VoteAggregate>;

const EMPTY: VoteAggregate = { upvotes: 0, weightedScore: 0, userVoted: false };

function votesQueryKey(symbols: string[]) {
  return ["votes", symbols.slice().sort().join(",")];
}

export function useVotes(symbols: string[]) {
  return useQuery<{ votes: VoteMap }, Error, Map<string, VoteAggregate>>({
    queryKey: votesQueryKey(symbols),
    enabled: symbols.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({ symbols: symbols.join(",") });
      const res = await fetch(`/api/votes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch votes");
      return res.json();
    },
    select: (data) => new Map(Object.entries(data.votes)),
    staleTime: 60_000,
  });
}

export function useVoteFor(symbol: string): VoteAggregate {
  const qc = useQueryClient();

  const fromCache = qc
    .getQueriesData<{ votes: VoteMap }>({ queryKey: ["votes"] })
    .map(([, data]) => data?.votes?.[symbol])
    .find((v) => v !== undefined);

  const { data } = useQuery<{ votes: VoteMap }>({
    queryKey: votesQueryKey([symbol]),
    enabled: fromCache === undefined,
    queryFn: async () => {
      const res = await fetch(`/api/votes?symbols=${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch vote");
      return res.json();
    },
    staleTime: 60_000,
  });

  return fromCache ?? data?.votes?.[symbol] ?? EMPTY;
}

export function useVoteMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ symbol, voted }: { symbol: string; voted: boolean }) => {
      const method = voted ? "POST" : "DELETE";
      const res = await fetch(`/api/tickers/${symbol}/vote`, { method });
      if (res.status === 401) throw new Error("NOT_AUTHENTICATED");
      if (!res.ok) throw new Error("Failed to vote");
      return res.json() as Promise<VoteAggregate>;
    },
    onMutate: async ({ symbol, voted }) => {
      await qc.cancelQueries({ queryKey: ["votes"] });
      const snapshots: Array<[readonly unknown[], unknown]> = [];

      qc.getQueriesData<{ votes: VoteMap }>({ queryKey: ["votes"] }).forEach(([key, data]) => {
        snapshots.push([key, data]);
        if (!data?.votes?.[symbol]) return;
        const prev = data.votes[symbol];
        if (prev.userVoted === voted) return;
        const next: VoteAggregate = {
          upvotes: prev.upvotes + (voted ? 1 : -1),
          weightedScore: Math.round((prev.weightedScore + (voted ? 1 : -1)) * 10) / 10,
          userVoted: voted,
        };
        qc.setQueryData(key, { votes: { ...data.votes, [symbol]: next } });
      });

      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (agg, { symbol }) => {
      qc.getQueriesData<{ votes: VoteMap }>({ queryKey: ["votes"] }).forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, { votes: { ...data.votes, [symbol]: agg } });
      });
      qc.invalidateQueries({ queryKey: ["trending"] });
      qc.invalidateQueries({ queryKey: ["ticker", symbol] });
    },
  });
}
