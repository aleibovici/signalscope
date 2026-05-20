"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { useVotes } from "@/hooks/use-votes";
import { useWatchlist, useWatchlistTickers } from "@/hooks/use-watchlist";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { StageTabs } from "@/components/dashboard/stage-tabs";
import { SignalCard } from "@/components/dashboard/signal-card";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function downloadWatchlistCSV(symbols: Set<string>) {
  const lines = ["Symbol", ...Array.from(symbols).sort()];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "signalscope-watchlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const VALID_STAGES = new Set(["Emerging", "Building", "Consensus"]);
const VIEW_MODE_KEY = "signalscope_view_mode";

function setCookieStage(stage: string) {
  document.cookie = `dashboard_stage=${encodeURIComponent(stage)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function DashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    searchParams.get("scanId")
  );
  const [selectedStage, setSelectedStage] = useState("Emerging");
  const [viewMode, setViewMode] = useState<"card" | "row">("card");

  // Restore stage from cookie after hydration to avoid SSR mismatch
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )dashboard_stage=([^;]*)/);
    if (!match) return;
    try {
      const value = decodeURIComponent(match[1]);
      if (VALID_STAGES.has(value)) setSelectedStage(value);
    } catch {
      // malformed cookie value — ignore and keep default
    }
  }, []);

  // Restore view mode from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "row" || saved === "card") setViewMode(saved);
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  function toggleViewMode() {
    const next = viewMode === "card" ? "row" : "card";
    setViewMode(next);
    try { localStorage.setItem(VIEW_MODE_KEY, next); } catch { /* ignore */ }
  }

useScrollRestore("dashboard");

  const { data: scansData } = useScans(1, 1);
  const { data: scanDetail, isLoading, isError } = useScanDetail(selectedScanId);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { data: watchlistTickersData } = useWatchlistTickers();

  // Auto-select the latest scan only if no scanId was provided via URL
  useEffect(() => {
    if (!selectedScanId && scansData?.scans?.[0]) {
      setSelectedScanId(scansData.scans[0].id);
    }
  }, [scansData, selectedScanId]);

  const tickers = scanDetail?.tickers || [];
  const filteredRaw = tickers.filter((t) => t.stage === selectedStage);

  // Bookmarked tickers float to top; within each group, API order (aiScore DESC, opportunityScore DESC) is preserved
  const filtered = [...filteredRaw].sort((a, b) => {
    const aB = bookmarkedSymbols.has(a.symbol) ? 0 : 1;
    const bB = bookmarkedSymbols.has(b.symbol) ? 0 : 1;
    return aB - bB;
  });

  // Watchlisted tickers missing from the current scan
  const scanSymbols = new Set(tickers.map((t) => t.symbol));
  const missingWatchlisted = (watchlistTickersData?.tickers ?? []).filter(
    (t) => !scanSymbols.has(t.symbol) && bookmarkedSymbols.has(t.symbol)
  );

  // Single batched votes fetch for every symbol on the page.
  // VoteButton's useVoteFor is cache-first and reads from this entry,
  // avoiding one /api/votes request per row.
  useVotes([
    ...tickers.map((t) => t.symbol),
    ...missingWatchlisted.map((t) => t.symbol),
  ]);

  const counts: Record<string, number> = {
    Emerging: tickers.filter((t) => t.stage === "Emerging").length,
    Building: tickers.filter((t) => t.stage === "Building").length,
    Consensus: tickers.filter((t) => t.stage === "Consensus").length,
  };

  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-h1 text-gray-900 dark:text-zinc-100">Signal Dashboard</h1>
          {scanDetail?.scan?.completedAt && (
            <p className="mt-0.5 num text-xs text-muted">Updated {timeAgo(scanDetail.scan.completedAt)}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            onClick={toggleViewMode}
            title={viewMode === "card" ? "Switch to row view" : "Switch to card view"}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            {viewMode === "card" ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            )}
            {viewMode === "card" ? "Rows" : "Cards"}
          </button>
          {session?.user && bookmarkedSymbols.size > 0 && (
            <button
              onClick={() => downloadWatchlistCSV(bookmarkedSymbols)}
              title={`Export ${bookmarkedSymbols.size} watchlist ticker${bookmarkedSymbols.size === 1 ? "" : "s"} as CSV for broker import`}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export watchlist
            </button>
          )}
          <ScanSelector
            selectedScanId={selectedScanId}
            onSelect={setSelectedScanId}
          />
        </div>
      </div>

      <StageTabs
        selected={selectedStage}
        onSelect={(stage) => { setSelectedStage(stage); setCookieStage(stage); }}
        counts={counts}
      />

{session?.user && missingWatchlisted.length > 0 && !isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Watchlist
            </h2>
            <span className="text-xs text-gray-400 dark:text-zinc-500">From previous scans</span>
          </div>
          <div className={viewMode === "card" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-1.5"}>
            {missingWatchlisted.map((ticker: ValidatedTickerData) => (
              <div key={ticker.id} className="opacity-75">
                <SignalCard ticker={ticker} variant={viewMode} stageFilter={selectedStage} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-red-600 dark:text-red-400">Failed to load signals. Please refresh and try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={selectedScanId ? "No signals found for this stage." : "No scans available. Run a scan to detect breakout signals."}
        />
      ) : (
        <div className={viewMode === "card" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-1.5"}>
          {filtered.map((ticker: ValidatedTickerData, i) => (
            <div key={ticker.id} id={i === 0 ? "tour-ticker-card" : undefined}>
              <SignalCard ticker={ticker} variant={viewMode} stageFilter={selectedStage} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
