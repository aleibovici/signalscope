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
import { scoreExplainerDashboardCallout } from "@/lib/score-explainer";

const VALID_STAGES = new Set(["ALL", "Emerging", "Building", "Consensus"]);

function setCookieStage(stage: string) {
  document.cookie = `dashboard_stage=${encodeURIComponent(stage)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function DashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    searchParams.get("scanId")
  );
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [calloutDismissed, setCalloutDismissed] = useState(false);

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

  // Restore callout dismissal from cookie
  useEffect(() => {
    if (document.cookie.includes("reading_cards_dismissed=1")) {
      setCalloutDismissed(true);
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
    ALL: tickers.length,
    Emerging: tickers.filter((t) => t.stage === "Emerging").length,
    Building: tickers.filter((t) => t.stage === "Building").length,
    Consensus: tickers.filter((t) => t.stage === "Consensus").length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 md:text-2xl">Signal Dashboard</h1>
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

      {!calloutDismissed && (
        <div className="flex items-start gap-3 border-l-[3px] border-gray-300 bg-gray-50/80 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-900/40">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="flex-1 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
            <span className="font-semibold text-gray-700 dark:text-zinc-200">Reading the cards:</span>{" "}
            {scoreExplainerDashboardCallout.replace(/^Reading the cards:\s*/i, "")}
          </p>
          <button
            onClick={() => {
              setCalloutDismissed(true);
              document.cookie = "reading_cards_dismissed=1; path=/; max-age=31536000; SameSite=Lax";
            }}
            className="mt-0.5 shrink-0 text-gray-300 hover:text-gray-500 dark:text-zinc-600 dark:hover:text-zinc-400"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

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
          {filtered.map((ticker: ValidatedTickerData) => (
            <SignalCard
              key={ticker.id}
              ticker={ticker}
              isBookmarked={bookmarkedSymbols.has(ticker.symbol)}
              onToggle={session?.user ? (symbol, isCurrent) => toggleWatchlist({ symbol, isBookmarked: isCurrent }) : undefined}
            />
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
