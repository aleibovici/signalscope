"use client";

import { useState } from "react";
import { useTickerNetwork, type NetworkFilters } from "@/hooks/use-network";
import { NetworkGraph, type ColorMode } from "@/components/dashboard/network-graph";
import { Spinner } from "@/components/ui/spinner";
import { STAGE_LABELS } from "@/lib/stage-labels";

const selectClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-400";

const SECTOR_LEGEND = [
  { label: "Technology", color: "#3b82f6" },
  { label: "Healthcare", color: "#ef4444" },
  { label: "Financial", color: "#10b981" },
  { label: "Energy", color: "#f59e0b" },
  { label: "Consumer", color: "#8b5cf6" },
  { label: "Industrials", color: "#6b7280" },
  { label: "Other", color: "#9ca3af" },
];

export default function ConnectionsPage() {
  const [filters, setFilters] = useState<NetworkFilters>({});
  const [colorMode, setColorMode] = useState<ColorMode>("stage");
  const { data, isLoading, isError } = useTickerNetwork(filters);

  function updateFilter(patch: Partial<NetworkFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      for (const key of Object.keys(next) as (keyof NetworkFilters)[]) {
        if (!next[key]) delete next[key];
      }
      return next;
    });
  }

  function handleNodeClick(symbol: string) {
    updateFilter({ symbol });
  }

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl dark:text-zinc-100">Connections</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Discover tickers with correlated price movements
          </p>
        </div>
        {filters.symbol && (
          <button
            onClick={() => updateFilter({ symbol: undefined })}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Show all
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Filters</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Center Symbol</label>
            <input
              type="text"
              value={filters.symbol || ""}
              onChange={(e) => updateFilter({ symbol: e.target.value.toUpperCase() || undefined })}
              placeholder="e.g. AAPL"
              className={selectClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Min Correlation</label>
            <select
              value={filters.minCorrelation || ""}
              onChange={(e) => updateFilter({ minCorrelation: e.target.value ? Number(e.target.value) : undefined })}
              className={selectClass}
            >
              <option value="">30% (default)</option>
              <option value="0.1">10%+</option>
              <option value="0.2">20%+</option>
              <option value="0.5">50%+</option>
              <option value="0.7">70%+</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Stage</label>
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
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Time Range</label>
            <select
              value={filters.days || ""}
              onChange={(e) => updateFilter({ days: e.target.value ? Number(e.target.value) : undefined })}
              className={selectClass}
            >
              <option value="">30 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Max Nodes</label>
            <select
              value={filters.maxNodes || ""}
              onChange={(e) => updateFilter({ maxNodes: e.target.value ? Number(e.target.value) : undefined })}
              className={selectClass}
            >
              <option value="">30 (default)</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="40">40</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>


      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {/* Nodes */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] rounded-l-xl dark:block"
              style={{ background: "linear-gradient(to bottom, #71717a, #a1a1aa)" }}
              aria-hidden="true"
            />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Nodes</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl dark:text-zinc-100">{data.nodes.length}</p>
          </div>

          {/* Edges */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] rounded-l-xl dark:block"
              style={{ background: "linear-gradient(to bottom, #3b82f6, #6366f1)" }}
              aria-hidden="true"
            />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Edges</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 md:text-3xl dark:text-blue-400">{data.edges.length}</p>
          </div>

          {/* Avg Connections */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] rounded-l-xl dark:block"
              style={{ background: "linear-gradient(to bottom, #4edea3, #3b82f6)" }}
              aria-hidden="true"
            />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Avg Connections</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl dark:text-zinc-100">
              {data.nodes.length > 0
                ? ((data.edges.length * 2) / data.nodes.length).toFixed(1)
                : "0"}
            </p>
          </div>
        </div>
      )}

      {/* Graph area */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-14 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load network data. Please refresh and try again.</p>
        </div>
      ) : !data || data.nodes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            No correlations found{filters.symbol ? ` for ${filters.symbol}` : ""}.
            {" "}Tickers need sufficient price snapshot data to compute correlations.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {filters.symbol ? (
                <>Centered on <span className="font-semibold text-gray-700 dark:text-zinc-200">{filters.symbol}</span></>
              ) : (
                "Top trending tickers"
              )}
              <span className="mx-2 text-gray-300 dark:text-zinc-700">—</span>
              <span className="hidden text-xs text-gray-400 dark:text-zinc-600 md:inline">
                click to select · double-click to re-center · scroll to zoom · drag to pan
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-600 md:hidden">
                tap to select · double-tap to re-center
              </span>
            </p>
            {/* Color mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setColorMode("stage")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  colorMode === "stage"
                    ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                    : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                Stage
              </button>
              <button
                type="button"
                onClick={() => setColorMode("sector")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  colorMode === "sector"
                    ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                    : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                Sector
              </button>
            </div>
          </div>
          <NetworkGraph
            nodes={data.nodes}
            edges={data.edges}
            centerSymbol={data.centerSymbol}
            colorMode={colorMode}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}

      {/* Legend */}
      {data && data.nodes.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-5 py-3 dark:border-zinc-800/60 dark:bg-zinc-900/20">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {colorMode === "stage" ? (
              <>
                <span className="font-semibold text-gray-700 dark:text-zinc-200">Stages</span>
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                  <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> {STAGE_LABELS.EARLY}
                </span>
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-500" /> {STAGE_LABELS.FORMING}
                </span>
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> {STAGE_LABELS.CONFIRMED}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-700 dark:text-zinc-200">Sectors</span>
                {SECTOR_LEGEND.map((s) => (
                  <span key={s.label} className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
              </>
            )}
            <span className="hidden text-gray-300 dark:text-zinc-700 sm:inline">·</span>
            <span className="text-gray-400 dark:text-zinc-500">Node size = AI score</span>
            <span className="text-gray-300 dark:text-zinc-700">·</span>
            <span className="flex items-center gap-1.5 text-gray-400 dark:text-zinc-500">
              <span className="inline-block h-0.5 w-4 rounded bg-green-500" /> Positive correlation
            </span>
            <span className="flex items-center gap-1.5 text-gray-400 dark:text-zinc-500">
              <span className="inline-block h-0.5 w-4 rounded bg-red-500" /> Negative correlation
            </span>
            <span className="text-gray-300 dark:text-zinc-700">·</span>
            <span className="text-gray-400 dark:text-zinc-500">Edge thickness = correlation strength</span>
          </div>
        </div>
      )}
    </div>
  );
}
