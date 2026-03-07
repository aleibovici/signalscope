"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const PAGE_SIZE = 20;

function GainCell({ value }: { value: number | null }) {
  if (value == null) return <td className="px-4 py-3 text-right text-gray-300">—</td>;
  return (
    <td className={`px-4 py-3 text-right font-semibold ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </td>
  );
}

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useLeaderboard(page, PAGE_SIZE);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Leaderboard</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load leaderboard. Please refresh and try again.</p>
        </div>
      ) : !data?.leaderboard.length ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No positions found. Add positions to your portfolio to appear on the leaderboard.
        </p>
      ) : (
        <>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3 text-right">3d</th>
                    <th className="px-4 py-3 text-right">7d</th>
                    <th className="px-4 py-3 text-right">30d</th>
                    <th className="px-4 py-3 text-right">Positions</th>
                    <th className="px-4 py-3 text-right">Win Rate</th>
                    <th className="px-4 py-3">Best Pick</th>
                    <th className="px-4 py-3 text-center">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.leaderboard.map((entry) => (
                    <tr key={entry.username} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {entry.rank <= 3 ? (
                          <span className="text-base">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{entry.username}</td>
                      <GainCell value={entry.gain3d} />
                      <GainCell value={entry.gain7d} />
                      <GainCell value={entry.gain30d} />
                      <td className="px-4 py-3 text-right text-gray-600">{entry.positionCount}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Math.round(entry.winRate * 100)}%</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{entry.bestSymbol}</span>
                        <span className={`ml-1.5 text-xs ${entry.bestGainPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {entry.bestGainPct >= 0 ? "+" : ""}{entry.bestGainPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.verifiedRate === 1 ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700" title="All prices verified against market data">
                            Verified
                          </span>
                        ) : entry.verifiedRate >= 0.5 ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700" title={`${Math.round(entry.verifiedRate * 100)}% of prices verified`}>
                            {Math.round(entry.verifiedRate * 100)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500" title="Self-reported prices">
                            Self-reported
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {data.pricesAsOf && (
            <p className="text-center text-xs text-gray-400">
              Prices as of {new Date(data.pricesAsOf).toLocaleString()}
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
