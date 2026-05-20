"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTrendingTickers, type TrendingFilters, type TrendingTicker } from "@/hooks/use-trending";
import { useVotes } from "@/hooks/use-votes";
import { SignalCard } from "@/components/dashboard/signal-card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { STAGE_LABELS } from "@/lib/stage-labels";

const PAGE_SIZE = 12;

function formatTimeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const checkboxLabelClass =
  "flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-zinc-300";

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
  { value: "POLYMARKET", label: "Polymarket" },
];

const SORT_OPTIONS = [
  { value: "", label: "Appearances" },
  { value: "opportunityScore", label: "Opportunity Score" },
  { value: "aiScore", label: "Confidence (AI)" },
  { value: "price", label: "Price" },
  { value: "return", label: "Return" },
  { value: "marketCap", label: "Market Cap" },
];

const RETURN_PERIODS = [
  { value: "1d", label: "1d" },
  { value: "3d", label: "3d" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
];

const hasActiveFilters = (f: TrendingFilters) =>
  f.minAppearances || f.stage?.length || f.trend?.length || f.sector?.length || f.marketCap?.length ||
  (f.sortBy && f.sortBy !== "aiScore") || f.source?.length || f.hidePnd || f.returnPeriod || f.near52wLow;

const countActiveFilters = (f: TrendingFilters) => {
  let n = 0;
  if (f.minAppearances) n++;
  if (f.stage?.length) n++;
  if (f.trend?.length) n++;
  if (f.sector?.length) n++;
  if (f.marketCap?.length) n++;
  if (f.sortBy && f.sortBy !== "aiScore") n++;
  if (f.source?.length) n++;
  if (f.hidePnd) n++;
  if (f.returnPeriod) n++;
  if (f.near52wLow) n++;
  return n;
};

function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; sub?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayLabel = value.length === 0 ? "All" : value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <span className="truncate">{displayLabel}</span>
        <svg className="ml-2 h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = checked ? value.filter((v) => v !== opt.value) : [...value, opt.value];
                  onChange(next);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-blue-500 bg-blue-600 dark:border-blue-400 dark:bg-blue-500" : "border-gray-300 dark:border-zinc-600"}`}>
                  {checked && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-gray-700 dark:text-zinc-200">{opt.label}</span>
                {opt.sub && <span className="ml-auto text-xs text-gray-400 dark:text-zinc-500">{opt.sub}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrendingTickerCard({
  ticker,
  returnPeriod,
}: {
  ticker: TrendingTicker;
  returnPeriod: string;
}) {
  const trending = useMemo(
    () => ({
      trend: ticker.trend,
      appearanceCount: ticker.appearanceCount,
    }),
    [ticker.trend, ticker.appearanceCount],
  );

  return <SignalCard ticker={ticker} returnPeriod={returnPeriod} trending={trending} />;
}

export default function TrendingPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TrendingFilters>({ sortBy: "aiScore" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data, isLoading, isError, dataUpdatedAt } = useTrendingTickers(page, PAGE_SIZE, filters);

  // Single batched votes fetch for every symbol on the page; VoteButton's
  // useVoteFor reads from this cache entry instead of firing per-row requests.
  useVotes((data?.tickers ?? []).map((t) => t.symbol));

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

  return (
    <div className="space-y-4 md:space-y-5">

      {/* Header */}
      <PageHeader
        title="Trending Tickers"
        subtitle="Tickers appearing across multiple scans, ranked by signal momentum"
        meta={dataUpdatedAt > 0 ? `Updated ${formatTimeAgo(new Date(dataUpdatedAt))}` : undefined}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="trending-filters"
            className="md:hidden"
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
          </Button>
        }
      />

      {/* Quick bar + filter panel */}
      <div className="space-y-3">
      {/* Quick bar: return period + sort (always visible) */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {RETURN_PERIODS.map((rp) => (
            <button
              key={rp.value}
              onClick={() => updateFilter({ returnPeriod: rp.value === "7d" ? undefined : rp.value as TrendingFilters["returnPeriod"] })}
              aria-pressed={(filters.returnPeriod || "7d") === rp.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                (filters.returnPeriod || "7d") === rp.value
                  ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                  : "text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
              }`}
            >
              {rp.label}
            </button>
          ))}
        </div>

        <Select
          className="w-[180px] shrink-0"
          ariaLabel="Sort tickers"
          value={filters.sortBy || ""}
          onChange={(v) => updateFilter({ sortBy: (v || undefined) as TrendingFilters["sortBy"] })}
          options={SORT_OPTIONS}
          renderValue={(o) => <span>Sort: {o?.label ?? "Appearances"}</span>}
        />

        {hasActiveFilters(filters) && (
          <button
            onClick={() => { setFilters({ sortBy: "aiScore" }); setPage(1); }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-950/50 dark:active:bg-blue-950/70"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Full filter panel — always visible on desktop, collapsible on mobile */}
      <div id="trending-filters" className={`${filtersOpen ? "block" : "hidden"} md:block`}>
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Filters</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <Select
              label="Min Appearances"
              className="w-full"
              value={String(filters.minAppearances || "")}
              onChange={(v) => updateFilter({ minAppearances: v ? Number(v) : undefined })}
              options={[
                { value: "", label: "2+ (default)" },
                { value: "3", label: "3+" },
                { value: "5", label: "5+" },
              ]}
            />

            <MultiSelectDropdown
              label="Stage"
              options={[
                { value: "Emerging", label: STAGE_LABELS.EARLY },
                { value: "Building", label: STAGE_LABELS.FORMING },
                { value: "Consensus", label: STAGE_LABELS.CONFIRMED },
              ]}
              value={filters.stage ?? []}
              onChange={(next) => updateFilter({ stage: next.length ? next : undefined })}
            />

            <MultiSelectDropdown
              label="Trend"
              options={[
                { value: "rising", label: "Rising" },
                { value: "falling", label: "Falling" },
                { value: "stable", label: "Stable" },
              ]}
              value={filters.trend ?? []}
              onChange={(next) => updateFilter({ trend: next.length ? next : undefined })}
            />

            <MultiSelectDropdown
              label="Sector"
              options={SECTORS.map((s) => ({ value: s, label: s }))}
              value={filters.sector ?? []}
              onChange={(next) => updateFilter({ sector: next.length ? next : undefined })}
            />

            <MultiSelectDropdown
              label="Market Cap"
              options={[
                { value: "micro", label: "Micro", sub: "<$300M" },
                { value: "small", label: "Small", sub: "$300M–$2B" },
                { value: "mid", label: "Mid", sub: "$2B–$10B" },
                { value: "large", label: "Large", sub: "$10B+" },
              ]}
              value={filters.marketCap ?? []}
              onChange={(next) => updateFilter({ marketCap: next.length ? (next as Array<"micro" | "small" | "mid" | "large">) : undefined })}
            />

            <MultiSelectDropdown
              label="Source"
              options={SOURCES}
              value={filters.source ?? []}
              onChange={(next) => updateFilter({ source: next.length ? next : undefined })}
            />

          </div>

          {/* Toggles row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 dark:border-zinc-800/60">
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={filters.hidePnd || false}
                onChange={(e) => updateFilter({ hidePnd: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-visible:ring-blue-400/40"
              />
              Hide P&D flagged
            </label>

            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={filters.near52wLow || false}
                onChange={(e) => updateFilter({ near52wLow: e.target.checked || undefined })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-visible:ring-blue-400/40"
              />
              Near 52W Low only
            </label>
          </div>
        </div>
      </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load trending tickers. Please refresh and try again.</p>
        </div>
      ) : !data?.tickers.length ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            No trending tickers found{hasActiveFilters(filters) ? " matching your filters" : ""}. Tickers need at least {filters.minAppearances || 2} appearances across completed scans in the last 30 days.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {data.tickers.map((ticker) => (
              <TrendingTickerCard
                key={ticker.id}
                ticker={ticker}
                returnPeriod={filters.returnPeriod || "7d"}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 active:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-800"
              >
                Previous
              </button>
              <span className="min-w-16 text-center text-sm text-gray-500 dark:text-zinc-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 active:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-800"
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
