"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { useWatchlist, useToggleWatchlist, useWatchlistTickers } from "@/hooks/use-watchlist";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { StageTabs } from "@/components/dashboard/stage-tabs";
import { SignalCard } from "@/components/dashboard/signal-card";
import { Spinner } from "@/components/ui/spinner";

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

useScrollRestore("dashboard");

  const { data: scansData } = useScans(1, 1);
  const { data: scanDetail, isLoading, isError } = useScanDetail(selectedScanId);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();
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

  const counts: Record<string, number> = {
    Emerging: tickers.filter((t) => t.stage === "Emerging").length,
    Building: tickers.filter((t) => t.stage === "Building").length,
    Consensus: tickers.filter((t) => t.stage === "Consensus").length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 md:text-2xl">Signal Dashboard</h1>
        <div className="flex items-center gap-2">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {missingWatchlisted.map((ticker: ValidatedTickerData) => (
              <div key={ticker.id} className="opacity-75">
                <SignalCard
                  ticker={ticker}
                  isBookmarked={true}
                  onToggle={(symbol, isCurrent) => toggleWatchlist({ symbol, isBookmarked: isCurrent })}
                />
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
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center dark:border-zinc-600">
          <p className="text-gray-500 dark:text-zinc-400">
            {selectedScanId
              ? "No signals found for this stage."
              : "No scans available. Run a scan to detect breakout signals."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ticker: ValidatedTickerData, i) => (
            <div key={ticker.id} id={i === 0 ? "tour-ticker-card" : undefined}>
              <SignalCard
                ticker={ticker}
                isBookmarked={bookmarkedSymbols.has(ticker.symbol)}
                onToggle={session?.user ? (symbol, isCurrent) => toggleWatchlist({ symbol, isBookmarked: isCurrent }) : undefined}
              />
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
