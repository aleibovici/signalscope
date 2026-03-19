"use client";

import { useState } from "react";
import { useTickerNetwork, type NetworkFilters } from "@/hooks/use-network";
import { NetworkGraph, type ColorMode } from "@/components/dashboard/network-graph";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { STAGE_LABELS } from "@/lib/stage-labels";

const selectClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

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
    <div className="space-y-3 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Connections</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Explore how tickers are connected through co-occurrence in scans
          </p>
        </div>
        {filters.symbol && (
          <button
            onClick={() => updateFilter({ symbol: undefined })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Show all
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 md:p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Center Symbol</label>
            <input
              type="text"
              value={filters.symbol || ""}
              onChange={(e) => updateFilter({ symbol: e.target.value.toUpperCase() || undefined })}
              placeholder="e.g. AAPL"
              className={selectClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Min Co-occurrence</label>
            <select
              value={filters.minWeight || ""}
              onChange={(e) => updateFilter({ minWeight: e.target.value ? Number(e.target.value) : undefined })}
              className={selectClass}
            >
              <option value="">Auto</option>
              <option value="3">3+</option>
              <option value="5">5+</option>
              <option value="10">10+</option>
              <option value="20">20+</option>
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Time Range</label>
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Max Nodes</label>
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

      {/* Auto-threshold notice */}
      {data && data.effectiveMinWeight != null && data.effectiveMinWeight > (filters.minWeight || 2) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Auto-raised min co-occurrence to <span className="font-semibold">{data.effectiveMinWeight}</span> for readability.
          {" "}Override with the Min Co-occurrence filter.
        </div>
      )}

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Nodes</p>
              <p className="text-lg font-bold text-gray-900 md:text-2xl">{data.nodes.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Edges</p>
              <p className="text-lg font-bold text-blue-600 md:text-2xl">{data.edges.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="!px-3 !py-2 md:!px-6 md:!py-4">
              <p className="text-xs text-gray-500 md:text-sm">Avg Connections</p>
              <p className="text-lg font-bold text-gray-900 md:text-2xl">
                {data.nodes.length > 0
                  ? ((data.edges.length * 2) / data.nodes.length).toFixed(1)
                  : "0"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Graph area */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load network data. Please refresh and try again.</p>
        </div>
      ) : !data || data.nodes.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No connections found{filters.symbol ? ` for ${filters.symbol}` : ""}. Tickers need at least 2 co-occurrences across completed scans.
        </p>
      ) : (
        <Card>
          <CardContent className="!p-0">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <p className="text-sm text-gray-500">
                {filters.symbol ? (
                  <>Centered on <span className="font-semibold text-gray-700">{filters.symbol}</span></>
                ) : (
                  "Top trending tickers"
                )}
                {" — "}
                <span className="text-gray-400">click to select, double-click to re-center, scroll to zoom, drag to pan</span>
              </p>
              {/* Color mode toggle */}
              <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setColorMode("stage")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    colorMode === "stage"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >Stage</button>
                <button
                  type="button"
                  onClick={() => setColorMode("sector")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    colorMode === "sector"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >Sector</button>
              </div>
            </div>
            <NetworkGraph
              nodes={data.nodes}
              edges={data.edges}
              centerSymbol={data.centerSymbol}
              colorMode={colorMode}
              onNodeClick={handleNodeClick}
            />
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {data && data.nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          {colorMode === "stage" ? (
            <>
              <span className="font-medium text-gray-700">Stages:</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> {STAGE_LABELS.EARLY}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-500" /> {STAGE_LABELS.FORMING}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> {STAGE_LABELS.CONFIRMED}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium text-gray-700">Sectors:</span>
              {SECTOR_LEGEND.map((s) => (
                <span key={s.label} className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                </span>
              ))}
            </>
          )}
          <span className="ml-2 text-gray-400">Node size = AI score</span>
          <span className="text-gray-400">Edge thickness = co-occurrence count</span>
        </div>
      )}
    </div>
  );
}
