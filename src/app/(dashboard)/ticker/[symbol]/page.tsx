"use client";

import { Fragment, useState, useEffect, useRef, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTickerDetail, useTickerHistory, useGenerateReport } from "@/hooks/use-scans";
import { useTickerPerformance } from "@/hooks/use-performance";
import { useRelatedTickers } from "@/hooks/use-related";
import { RelatedTickers } from "@/components/ticker/related-tickers";
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { AddPositionModal } from "@/components/dashboard/add-position-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Sparkline } from "@/components/ui/sparkline";
import { TradeSetupCard } from "@/components/ticker/trade-setup-card";

function TickerMetric({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function TickerDetailPage() {
  const router = useRouter();
  const { symbol } = useParams<{ symbol: string }>();
  const { data, isLoading, error } = useTickerDetail(symbol);
  const { data: historyData } = useTickerHistory(symbol);
  const { data: perfData } = useTickerPerformance(symbol);
  const { data: relatedData, isLoading: relatedLoading } = useRelatedTickers(symbol);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null | undefined>(undefined);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const reportGenerated = useRef(false);
  const { mutate: generateReport, isPending: reportGenerating, isError: reportError } = useGenerateReport(symbol);

  async function refreshPrice() {
    if (priceRefreshing) return;
    setPriceRefreshing(true);
    try {
      const res = await fetch(`/api/prices?symbols=${symbol}`);
      if (res.ok) {
        const json = await res.json();
        setLivePrice(json.prices?.[symbol.toUpperCase()] ?? null);
      }
    } finally {
      setPriceRefreshing(false);
    }
  }

  // Auto-generate report if missing
  useEffect(() => {
    if (data?.ticker && !data.ticker.catalyst && !reportGenerated.current && !reportGenerating) {
      reportGenerated.current = true;
      generateReport();
    }
  }, [data?.ticker, generateReport, reportGenerating]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-zinc-400">
        Ticker not found or no data available.
      </div>
    );
  }

  const { ticker, signals } = data;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
        <div className="border-b border-gray-200 px-4 py-4 md:px-6 md:py-5 dark:border-zinc-800">
          <button
            onClick={() => router.back()}
            className="mb-3 text-sm text-gray-500 transition-colors hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
            type="button"
          >
            &larr; Back
          </button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 md:text-4xl">
                {ticker.symbol}
              </h1>
              {ticker.name ? (
                <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-zinc-400">{ticker.name}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                aria-label={bookmarkedSymbols.has(ticker.symbol) ? "Remove bookmark" : "Bookmark ticker"}
                onClick={() =>
                  toggleWatchlist({ symbol: ticker.symbol, isBookmarked: bookmarkedSymbols.has(ticker.symbol) })
                }
                className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:hover:bg-zinc-800/80"
              >
                {bookmarkedSymbols.has(ticker.symbol) ? (
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-gray-300 transition-colors hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAddPosition(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/35 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70"
              >
                + Position
              </button>
              <Badge
                variant={
                  ticker.stage === "Emerging"
                    ? "success"
                    : ticker.stage === "Building"
                      ? "warning"
                      : ticker.stage === "Consensus"
                        ? "info"
                        : "info"
                }
              >
                {ticker.stage}
              </Badge>
              {ticker.recommendation && (
                <Badge variant={ticker.recommendation === "Avoid" ? "danger" : "success"}>
                  {ticker.recommendation}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TickerMetric label="Price">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-50 md:text-xl">
                  {livePrice !== undefined
                    ? livePrice !== null
                      ? `$${livePrice.toFixed(2)}`
                      : "N/A"
                    : ticker.price
                      ? `$${ticker.price.toFixed(2)}`
                      : "N/A"}
                </span>
                {livePrice != null && (
                  <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    Live
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshPrice}
                  disabled={priceRefreshing}
                  aria-label="Refresh price"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200/80 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  {priceRefreshing ? (
                    <Spinner className="h-3.5 w-3.5 dark:text-blue-400" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16" />
                      <path d="M21 3v5h-5M3 21v-5h5" />
                    </svg>
                  )}
                </button>
              </div>
            </TickerMetric>
            <TickerMetric label="Market cap">
              <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-50 md:text-xl">
                {ticker.marketCap ? `$${(ticker.marketCap / 1e9).toFixed(2)}B` : "N/A"}
              </span>
            </TickerMetric>
            <TickerMetric label="Opportunity">
              <span className="text-lg font-semibold tabular-nums text-blue-600 dark:text-blue-400 md:text-xl">
                {ticker.opportunityScore}
                <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">/100</span>
              </span>
            </TickerMetric>
            <TickerMetric label="AI confidence">
              <span className="text-lg font-semibold tabular-nums text-gray-800 dark:text-zinc-200 md:text-xl">
                {ticker.aiScore}
                <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">/100</span>
              </span>
            </TickerMetric>
            <TickerMetric label="Sources">
              <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-50 md:text-xl">
                {ticker.sourceCount}
              </span>
            </TickerMetric>
            <TickerMetric label="Signals">
              <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-50 md:text-xl">
                {ticker.signalCount}
              </span>
            </TickerMetric>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-zinc-500">
            Opportunity = early-mover potential. AI score = evidence strength — high values can mean the crowd already
            agrees.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Thesis &amp; risks</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {reportGenerating ? (
            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <Spinner className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-zinc-300">Generating AI analysis…</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-blue-100/80 bg-blue-50/90 p-4 dark:border-blue-900/40 dark:bg-blue-950/35">
                <p className="text-sm leading-relaxed text-blue-950 dark:text-blue-100">
                  <span className="mr-1 font-semibold text-blue-900 dark:text-blue-200">Thesis:</span>
                  {ticker.catalyst || (reportError ? "AI analysis unavailable." : "No catalyst data available.")}
                </p>
              </div>
              {ticker.risks && (
                <div className="rounded-xl border border-amber-100/80 bg-amber-50/90 p-4 dark:border-amber-900/35 dark:bg-amber-950/30">
                  <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">
                    <span className="mr-1 font-semibold text-amber-900 dark:text-amber-200">Risks:</span>
                    {ticker.risks}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TradeSetupCard ticker={ticker} />

      {perfData?.latest && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Price performance</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              {([
                { label: "1 Day", value: perfData.latest.return1d },
                { label: "3 Day", value: perfData.latest.return3d },
                { label: "7 Day", value: perfData.latest.return7d },
                { label: "30 Day", value: perfData.latest.return30d },
              ] as const).map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/35"
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-500">{item.label}</p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      item.value == null
                        ? "text-gray-300 dark:text-zinc-600"
                        : item.value > 0
                          ? "text-green-600 dark:text-green-400"
                          : item.value < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-zinc-300"
                    }`}
                  >
                    {item.value != null
                      ? `${item.value > 0 ? "+" : ""}${(item.value * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400 dark:text-zinc-500">
              Detection price: ${perfData.latest.detectionPrice.toFixed(2)} on{" "}
              {new Date(perfData.latest.validatedTicker.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </CardContent>
        </Card>
      )}

      {(ticker.report || reportGenerating) && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">AI analysis report</h3>
          </CardHeader>
          <CardContent>
            {reportGenerating ? (
              <div className="flex items-center gap-2 py-4">
                <Spinner className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-gray-600 dark:text-zinc-300">Generating full report…</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-zinc-300">
                {ticker.report!.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RelatedTickers
        tickers={relatedData?.relatedTickers ?? []}
        isLoading={relatedLoading}
      />

      {/* Score History */}
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left"
          >
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Score history</h3>
            <div className="flex items-center gap-2">
              {historyData && (
                <span className="text-sm text-gray-500 dark:text-zinc-500">
                  {historyData.history.length} scan{historyData.history.length !== 1 ? "s" : ""}
                </span>
              )}
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 dark:text-zinc-500 ${historyOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </CardHeader>
        {historyOpen && (
        <CardContent>
          {!historyData ? (
            <div className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">Loading history…</div>
          ) : historyData.history.length <= 1 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400">Only one scan recorded for this ticker yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-1 py-1 dark:border-zinc-800/80 dark:bg-zinc-900/35">
                <Sparkline
                  points={historyData.history.map((h) => ({
                    score: h.aiScore,
                    stage: h.stage,
                    date: new Date(h.startedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }),
                  }))}
                />
              </div>
              {(() => {
                const reversed = [...historyData.history].reverse();
                const stageOrder: Record<string, number> = { CONFIRMED: 3, FORMING: 2, EARLY: 1, FILTERED: 0 };
                const grouped = reversed.reduce<
                  { dateKey: string; label: string; best: typeof reversed[0]; entries: typeof reversed }[]
                >((acc, h) => {
                  const dateKey = new Date(h.startedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  let group = acc.find((g) => g.dateKey === dateKey);
                  if (!group) {
                    group = { dateKey, label: dateKey, best: h, entries: [] };
                    acc.push(group);
                  }
                  group.entries.push(h);
                  if (
                    h.aiScore > group.best.aiScore ||
                    (h.aiScore === group.best.aiScore &&
                      (stageOrder[h.stage] ?? 0) > (stageOrder[group.best.stage] ?? 0))
                  ) {
                    group.best = h;
                  }
                  return acc;
                }, []);

                const INITIAL_DAYS = 7;
                const visibleGroups = showAllHistory ? grouped : grouped.slice(0, INITIAL_DAYS);
                const hasMore = grouped.length > INITIAL_DAYS;

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 pr-4 font-medium">Best Score</th>
                          <th className="pb-2 pr-4 font-medium">Stage</th>
                          <th className="pb-2 pr-4 font-medium">Price</th>
                          <th className="pb-2 font-medium">Scans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleGroups.map((group) => {
                          const isExpanded = expandedDates.has(group.dateKey);
                          const hasMultiple = group.entries.length > 1;
                          return (
                            <Fragment key={group.dateKey}>
                              <tr
                                className={`border-b border-gray-50 dark:border-zinc-800/80 ${hasMultiple ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50" : ""}`}
                                onClick={
                                  hasMultiple
                                    ? () =>
                                        setExpandedDates((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(group.dateKey)) next.delete(group.dateKey);
                                          else next.add(group.dateKey);
                                          return next;
                                        })
                                    : undefined
                                }
                              >
                                <td className="py-1.5 pr-4 text-gray-600 dark:text-zinc-300">
                                  {group.label}
                                </td>
                                <td className="py-1.5 pr-4 font-semibold text-blue-600 dark:text-blue-400">
                                  {group.best.aiScore}
                                </td>
                                <td className="py-1.5 pr-4">
                                  <Badge
                                    variant={
                                      group.best.stage === "Emerging"
                                        ? "success"
                                        : group.best.stage === "Building"
                                          ? "warning"
                                          : group.best.stage === "Consensus"
                                            ? "info"
                                            : "info"
                                    }
                                  >
                                    {group.best.stage}
                                  </Badge>
                                </td>
                                <td className="py-1.5 pr-4 text-gray-600 dark:text-zinc-300">
                                  {group.best.price ? `$${group.best.price.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-1.5 text-gray-500 dark:text-zinc-500">
                                  {hasMultiple ? (
                                    <span className="inline-flex items-center gap-1">
                                      {group.entries.length}
                                      <svg
                                        className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </span>
                                  ) : (
                                    "1"
                                  )}
                                </td>
                              </tr>
                              {isExpanded &&
                                group.entries.map((h) => (
                                  <tr
                                    key={h.scanId}
                                    className="border-b border-gray-50 bg-gray-50/50 dark:border-zinc-800/80 dark:bg-zinc-900/40"
                                  >
                                    <td className="py-1 pr-4 pl-4 text-xs text-gray-400 dark:text-zinc-500">
                                      {new Date(h.startedAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                    <td className="py-1 pr-4 text-sm text-blue-500 dark:text-blue-400">
                                      {h.aiScore}
                                    </td>
                                    <td className="py-1 pr-4">
                                      <Badge
                                        variant={
                                          h.stage === "Emerging"
                                            ? "success"
                                            : h.stage === "Building"
                                              ? "warning"
                                              : h.stage === "Consensus"
                                                ? "info"
                                                : "info"
                                        }
                                      >
                                        {h.stage}
                                      </Badge>
                                    </td>
                                    <td className="py-1 pr-4 text-xs text-gray-500 dark:text-zinc-400">
                                      {h.price ? `$${h.price.toFixed(2)}` : "—"}
                                    </td>
                                    <td />
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowAllHistory((v) => !v)}
                        className="mt-3 w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {showAllHistory
                          ? "Show recent only"
                          : `Show all ${grouped.length} days`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setSignalsOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left"
          >
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Signals</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-zinc-500">{signals.length}</span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 dark:text-zinc-500 ${signalsOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </CardHeader>
        {signalsOpen && <CardContent>
          <div className="space-y-3">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start justify-between rounded-xl border border-gray-100 p-3 transition-colors hover:border-gray-200 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{signal.source}</Badge>
                    {signal.pndFlagged && (
                      <Badge variant="danger">P&D Flag</Badge>
                    )}
                  </div>
                  {signal.title && (
                    <p className="mt-1 wrap-break-word text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {signal.url && /^https?:\/\//.test(signal.url) ? (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {signal.title}
                        </a>
                      ) : (
                        signal.title
                      )}
                    </p>
                  )}
                </div>
                <div className="ml-4 shrink-0 text-right text-xs text-gray-400 dark:text-zinc-500">
                  {signal.upvotes != null && <span>{signal.upvotes} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>}
      </Card>

      {showAddPosition && (
        <AddPositionModal
          symbol={ticker.symbol}
          onClose={() => setShowAddPosition(false)}
        />
      )}
    </div>
  );
}
