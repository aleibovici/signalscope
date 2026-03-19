"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useScans, useScanDetail, type ValidatedTickerData } from "@/hooks/use-scans";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { useWatchlist, useToggleWatchlist, useWatchlistTickers } from "@/hooks/use-watchlist";
import { ScanSelector } from "@/components/dashboard/scan-selector";
import { StageTabs } from "@/components/dashboard/stage-tabs";
import { SignalCard } from "@/components/dashboard/signal-card";
import { Spinner } from "@/components/ui/spinner";
import { scoreExplainerDashboardCallout } from "@/lib/score-explainer";

const VALID_STAGES = new Set(["ALL", "Emerging", "Building", "Consensus"]);

function setCookieStage(stage: string) {
  document.cookie = `dashboard_stage=${encodeURIComponent(stage)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    searchParams.get("scanId")
  );
  const [selectedStage, setSelectedStage] = useState("ALL");

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
  const filteredRaw =
    selectedStage === "ALL"
      ? tickers
      : tickers.filter((t) => t.stage === selectedStage);

  // Bookmarked tickers float to top; within each group, API order (opportunityScore DESC) is preserved
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
    ALL: tickers.length,
    Emerging: tickers.filter((t) => t.stage === "Emerging").length,
    Building: tickers.filter((t) => t.stage === "Building").length,
    Consensus: tickers.filter((t) => t.stage === "Consensus").length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Signal Dashboard</h1>
        <ScanSelector
          selectedScanId={selectedScanId}
          onSelect={setSelectedScanId}
        />
      </div>

      <StageTabs
        selected={selectedStage}
        onSelect={(stage) => { setSelectedStage(stage); setCookieStage(stage); }}
        counts={counts}
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
        {scoreExplainerDashboardCallout}
      </div>

      {missingWatchlisted.length > 0 && !isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Watchlist
            </h2>
            <span className="text-xs text-gray-400">From previous scans</span>
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
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
          <p className="text-red-600">Failed to load signals. Please refresh and try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">
            {selectedScanId
              ? "No signals found for this stage."
              : "No scans available. Run a scan to detect breakout signals."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ticker: ValidatedTickerData) => (
            <SignalCard
              key={ticker.id}
              ticker={ticker}
              isBookmarked={bookmarkedSymbols.has(ticker.symbol)}
              onToggle={(symbol, isCurrent) => toggleWatchlist({ symbol, isBookmarked: isCurrent })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-blue-600" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
