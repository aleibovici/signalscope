"use client";

import { useState } from "react";
import { useTrendingTickers, type TrendingFilters } from "@/hooks/use-trending";
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { TrendingCard } from "@/components/dashboard/trending-card";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { STAGE_LABELS } from "@/lib/stage-labels";

const PAGE_SIZE = 12;
const selectClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const checkboxLabelClass =
  "flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none";

const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Energy",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Basic Materials",
  "Communication Services",
  "Real Estate",
  "Utilities",
];

const SOURCES = [
  { value: "REDDIT", label: "Reddit" },
  { value: "TWITTER", label: "Twitter" },
  { value: "STOCKTWITS", label: "StockTwits" },
  { value: "SEC_INSIDER", label: "SEC Insider" },
  { value: "CONGRESS", label: "Congress" },
  { value: "VOLUME_SPIKE", label: "Volume Spike" },
];

const SORT_OPTIONS = [
  { value: "", label: "Appearances" },
  { value: "opportunityScore", label: "Opportunity Score" },
  { value: "aiScore", label: "AI Score" },
  { value: "price", label: "Price" },
  { value: "return", label: "Return" },
  { value: "marketCap", label: "Market Cap" },
];

const RETURN_PERIODS = [
  { value: "1d", label: "1d" },
  { value: "3d", label: "3d" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const hasActiveFilters = (f: TrendingFilters) =>
  f.minAppearances || f.stage || f.trend || f.sector || f.marketCap ||
  f.sortBy || f.source || f.hidePnd || f.returnPeriod || f.near52wLow;

const countActiveFilters = (f: TrendingFilters) => {
  let n = 0;
  if (f.minAppearances) n++;
  if (f.stage) n++;
  if (f.trend) n++;
  if (f.sector) n++;
  if (f.marketCap) n++;
  if (f.sortBy) n++;
  if (f.source) n++;
  if (f.hidePnd) n++;
  if (f.returnPeriod) n++;
  if (f.near52wLow) n++;
  return n;
};

export default function TrendingPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TrendingFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data, isLoading, isError } = useTrendingTickers(page, PAGE_SIZE, filters);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const activeCount = countActiveFilters(filters);

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
    <div className="space-y-3 md:space-y-5">
      {/* Header + filter toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Trending Tickers</h1>
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 md:hidden"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Quick bar: return period + sort (always visible on mobile) */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 -mb-1">
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
          {RETURN_PERIODS.map((rp) => (
            <button
              key={rp.value}
              onClick={() => updateFilter({ returnPeriod: rp.value === "7d" ? undefined : rp.value as TrendingFilters["returnPeriod"] })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                (filters.returnPeriod || "7d") === rp.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              }`}
            >
              {rp.label}
            </button>
          ))}
        </div>

        <select
          value={filters.sortBy || ""}
          onChange={(e) => updateFilter({ sortBy: (e.target.value || undefined) as TrendingFilters["sortBy"] })}
          className="h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>Sort: {s.label}</option>
          ))}
        </select>

        {hasActiveFilters(filters) && (
          <button
            onClick={() => { setFilters({}); setPage(1); }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Full filter panel — always visible on desktop, collapsible on mobile */}
      <div className={`${filtersOpen ? "block" : "hidden"} md:block`}>
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 md:p-4">
          {/* Dropdown grid: 2 cols on mobile, 4 on tablet, 7 on desktop */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Min Appearances</label>
              <select
                value={filters.minAppearances || ""}
                onChange={(e) => updateFilter({ minAppearances: e.target.value ? Number(e.target.value) : undefined })}
                className={selectClass}
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
                className={selectClass}
              >
                <option value="">All</option>
                <option value="Emerging">{STAGE_LABELS.EARLY}</option>
                <option value="Building">{STAGE_LABELS.FORMING}</option>
                <option value="Consensus">{STAGE_LABELS.CONFIRMED}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Trend</label>
              <select
                value={filters.trend || ""}
                onChange={(e) => updateFilter({ trend: e.target.value || undefined })}
                className={selectClass}
              >
                <option value="">All</option>
                <option value="rising">Rising</option>
                <option value="falling">Falling</option>
                <option value="stable">Stable</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Sector</label>
              <select
                value={filters.sector || ""}
                onChange={(e) => updateFilter({ sector: e.target.value || undefined })}
                className={selectClass}
              >
                <option value="">All</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Market Cap</label>
              <select
                value={filters.marketCap || ""}
                onChange={(e) => updateFilter({ marketCap: (e.target.value || undefined) as TrendingFilters["marketCap"] })}
                className={selectClass}
              >
                <option value="">All</option>
                <option value="micro">Micro (&lt;$300M)</option>
                <option value="small">Small ($300M–$2B)</option>
                <option value="mid">Mid ($2B–$10B)</option>
                <option value="large">Large ($10B+)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Source</label>
              <select
                value={filters.source || ""}
                onChange={(e) => updateFilter({ source: e.target.value || undefined })}
                className={selectClass}
              >
                <option value="">All</option>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Sort dropdown (desktop only — already in quick bar on mobile) */}
            <div className="hidden lg:block">
              <label className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
              <select
                value={filters.sortBy || ""}
                onChange={(e) => updateFilter({ sortBy: (e.target.value || undefined) as TrendingFilters["sortBy"] })}
                className={selectClass}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggles row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={filters.hidePnd || false}
                onChange={(e) => updateFilter({ hidePnd: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Hide P&D flagged
            </label>

            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={filters.near52wLow || false}
                onChange={(e) => updateFilter({ near52wLow: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Near 52W Low only
            </label>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Trending</p>
              <p className="text-lg font-bold text-gray-900 md:text-2xl">{data.summary.totalTrending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Rising</p>
              <p className="text-lg font-bold text-green-600 md:text-2xl">{data.summary.risingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Avg Score</p>
              <p className="text-lg font-bold text-gray-900 md:text-2xl">{data.summary.avgScore}</p>
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
          No trending tickers found{hasActiveFilters(filters) ? " matching your filters" : ""}. Tickers need at least {filters.minAppearances || 2} appearances across completed scans in the last 30 days.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.tickers.map((ticker) => (
              <TrendingCard
                key={ticker.id}
                ticker={ticker}
                isBookmarked={bookmarkedSymbols.has(ticker.symbol)}
                onToggle={handleToggle}
                returnPeriod={filters.returnPeriod || "7d"}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40 active:bg-gray-100"
              >
                Previous
              </button>
              <span className="min-w-[4rem] text-center text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40 active:bg-gray-100"
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
