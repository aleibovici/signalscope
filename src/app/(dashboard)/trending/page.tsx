"use client";

import { useState } from "react";
import { useTrendingTickers, type TrendingFilters } from "@/hooks/use-trending";
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { TrendingCard } from "@/components/dashboard/trending-card";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const PAGE_SIZE = 12;
const filterInputClass =
  "h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function TrendingPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TrendingFilters>({});
  const { data, isLoading, isError } = useTrendingTickers(page, PAGE_SIZE, filters);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function updateFilter(patch: Partial<TrendingFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      for (const key of Object.keys(next) as (keyof TrendingFilters)[]) {
        if (!next[key]) delete next[key];
      }
      return next;
    });
    setPage(1);
  }

  function handleToggle(symbol: string, isBookmarked: boolean) {
    toggleWatchlist({ symbol, isBookmarked });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Trending Tickers</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Min Appearances</label>
          <select
            value={filters.minAppearances || ""}
            onChange={(e) => updateFilter({ minAppearances: e.target.value ? Number(e.target.value) : undefined })}
            className={filterInputClass}
          >
            <option value="">2+ (default)</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Stage</label>
          <select
            value={filters.stage || ""}
            onChange={(e) => updateFilter({ stage: e.target.value || undefined })}
            className={filterInputClass}
          >
            <option value="">All</option>
            <option value="EARLY">Early</option>
            <option value="FORMING">Forming</option>
            <option value="CONFIRMED">Confirmed</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Trend</label>
          <select
            value={filters.trend || ""}
            onChange={(e) => updateFilter({ trend: e.target.value || undefined })}
            className={filterInputClass}
          >
            <option value="">All</option>
            <option value="rising">Rising</option>
            <option value="falling">Falling</option>
            <option value="stable">Stable</option>
          </select>
        </div>

        {(filters.minAppearances || filters.stage || filters.trend) && (
          <button
            onClick={() => { setFilters({}); setPage(1); }}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary stats */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <p className="text-sm text-gray-500">Total Trending</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalTrending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-gray-500">Rising</p>
              <p className="text-2xl font-bold text-green-600">{data.summary.risingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-gray-500">Avg Score</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.avgScore}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load trending tickers. Please refresh and try again.</p>
        </div>
      ) : !data?.tickers.length ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No trending tickers found{(filters.minAppearances || filters.stage || filters.trend) ? " matching your filters" : ""}. Tickers need at least {filters.minAppearances || 2} appearances across completed scans in the last 30 days.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.tickers.map((ticker) => (
              <TrendingCard
                key={ticker.id}
                ticker={ticker}
                isBookmarked={bookmarkedSymbols.has(ticker.symbol)}
                onToggle={handleToggle}
              />
            ))}
          </div>

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
