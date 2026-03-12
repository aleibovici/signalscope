"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTickerDetail, useTickerHistory, useGenerateReport } from "@/hooks/use-scans";
import { useTickerPerformance } from "@/hooks/use-performance";
import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Sparkline } from "@/components/ui/sparkline";
import { stageLabel } from "@/lib/stage-labels";
import { TradeSetupCard } from "@/components/ticker/trade-setup-card";

export default function TickerDetailPage() {
  const router = useRouter();
  const { symbol } = useParams<{ symbol: string }>();
  const { data, isLoading, error } = useTickerDetail(symbol);
  const { data: historyData } = useTickerHistory(symbol);
  const { data: perfData } = useTickerPerformance(symbol);
  const { data: bookmarkedSymbols = new Set<string>() } = useWatchlist();
  const { mutate: toggleWatchlist } = useToggleWatchlist();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [signalsOpen, setSignalsOpen] = useState(false);
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
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-gray-500">
        Ticker not found or no data available.
      </div>
    );
  }

  const { ticker, signals } = data;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline"
          type="button"
        >
          &larr; Back
        </button>
        <h1 className="text-xl font-bold md:text-2xl">{ticker.symbol}</h1>
        <button
          type="button"
          aria-label={bookmarkedSymbols.has(ticker.symbol) ? "Remove bookmark" : "Bookmark ticker"}
          onClick={() => toggleWatchlist({ symbol: ticker.symbol, isBookmarked: bookmarkedSymbols.has(ticker.symbol) })}
          className="rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {bookmarkedSymbols.has(ticker.symbol) ? (
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-300 hover:text-amber-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>
        <Badge variant={ticker.stage === "EARLY" ? "success" : ticker.stage === "FORMING" ? "warning" : ticker.stage === "CONFIRMED" ? "info" : "info"}>
          {stageLabel(ticker.stage)}
        </Badge>
        {ticker.recommendation && (
          <Badge variant={ticker.recommendation === "Avoid" ? "danger" : "success"}>
            {ticker.recommendation}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Price & Score</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Price</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">
                  {livePrice !== undefined
                    ? livePrice !== null ? `$${livePrice.toFixed(2)}` : "N/A"
                    : ticker.price ? `$${ticker.price.toFixed(2)}` : "N/A"}
                </span>
                {livePrice != null && (
                  <span className="rounded bg-green-50 px-1 py-0.5 text-xs font-medium text-green-600">
                    live
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshPrice}
                  disabled={priceRefreshing}
                  aria-label="Refresh price"
                  className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                >
                  {priceRefreshing ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16" />
                      <path d="M21 3v5h-5M3 21v-5h5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Market Cap</span>
              <span className="font-medium">
                {ticker.marketCap
                  ? `$${(ticker.marketCap / 1e9).toFixed(2)}B`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AI Score</span>
              <span className="font-bold text-blue-600">
                {ticker.aiScore}/100
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sources</span>
              <span className="font-medium">{ticker.sourceCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Signals</span>
              <span className="font-medium">{ticker.signalCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="font-semibold">Thesis & Risks</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportGenerating ? (
              <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                <Spinner className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-gray-600">Generating AI analysis...</p>
              </div>
            ) : (
              <>
                <div className="rounded-md bg-blue-50 p-3">
                  <p className="text-sm text-blue-900">
                    <span className="mr-1 font-semibold">Thesis:</span>
                    {ticker.catalyst || (reportError ? "AI analysis unavailable." : "No catalyst data available.")}
                  </p>
                </div>
                {ticker.risks && (
                  <div className="rounded-md bg-amber-50 p-3">
                    <p className="text-sm text-amber-900">
                      <span className="mr-1 font-semibold">Risks:</span>
                      {ticker.risks}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TradeSetupCard ticker={ticker} />

      {perfData?.latest && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Price Performance</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              {([
                { label: "1 Day", value: perfData.latest.return1d },
                { label: "3 Day", value: perfData.latest.return3d },
                { label: "7 Day", value: perfData.latest.return7d },
                { label: "30 Day", value: perfData.latest.return30d },
              ] as const).map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p
                    className={`text-lg font-semibold ${
                      item.value == null
                        ? "text-gray-300"
                        : item.value > 0
                          ? "text-green-600"
                          : item.value < 0
                            ? "text-red-600"
                            : "text-gray-600"
                    }`}
                  >
                    {item.value != null
                      ? `${item.value > 0 ? "+" : ""}${(item.value * 100).toFixed(1)}%`
                      : "--"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
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
            <h3 className="font-semibold">AI Analysis Report</h3>
          </CardHeader>
          <CardContent>
            {reportGenerating ? (
              <div className="flex items-center gap-2 py-4">
                <Spinner className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-gray-600">Generating full report...</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-700">
                {ticker.report!.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score History */}
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left"
          >
            <h3 className="font-semibold">Score History</h3>
            <div className="flex items-center gap-2">
              {historyData && (
                <span className="text-sm text-gray-500">
                  {historyData.history.length} scan{historyData.history.length !== 1 ? "s" : ""}
                </span>
              )}
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}
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
            <div className="py-4 text-center text-sm text-gray-400">Loading history...</div>
          ) : historyData.history.length <= 1 ? (
            <p className="text-sm text-gray-500">Only one scan recorded for this ticker yet.</p>
          ) : (
            <div className="space-y-4">
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
                        <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
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
                                className={`border-b border-gray-50 ${hasMultiple ? "cursor-pointer hover:bg-gray-50" : ""}`}
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
                                <td className="py-1.5 pr-4 text-gray-600">
                                  {group.label}
                                </td>
                                <td className="py-1.5 pr-4 font-semibold text-blue-600">
                                  {group.best.aiScore}
                                </td>
                                <td className="py-1.5 pr-4">
                                  <Badge
                                    variant={
                                      group.best.stage === "EARLY"
                                        ? "success"
                                        : group.best.stage === "FORMING"
                                          ? "warning"
                                          : group.best.stage === "CONFIRMED"
                                            ? "info"
                                            : "info"
                                    }
                                  >
                                    {stageLabel(group.best.stage)}
                                  </Badge>
                                </td>
                                <td className="py-1.5 pr-4 text-gray-600">
                                  {group.best.price ? `$${group.best.price.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-1.5 text-gray-500">
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
                                    className="border-b border-gray-50 bg-gray-50/50"
                                  >
                                    <td className="py-1 pr-4 pl-4 text-xs text-gray-400">
                                      {new Date(h.startedAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                    <td className="py-1 pr-4 text-sm text-blue-500">
                                      {h.aiScore}
                                    </td>
                                    <td className="py-1 pr-4">
                                      <Badge
                                        variant={
                                          h.stage === "EARLY"
                                            ? "success"
                                            : h.stage === "FORMING"
                                              ? "warning"
                                              : h.stage === "CONFIRMED"
                                                ? "info"
                                                : "info"
                                        }
                                      >
                                        {stageLabel(h.stage)}
                                      </Badge>
                                    </td>
                                    <td className="py-1 pr-4 text-xs text-gray-500">
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
                        className="mt-3 w-full text-center text-sm text-blue-600 hover:underline"
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
            <h3 className="font-semibold">Signals</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{signals.length}</span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${signalsOpen ? "rotate-180" : ""}`}
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
                className="flex items-start justify-between rounded-lg border border-gray-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{signal.source}</Badge>
                    {signal.pndFlagged && (
                      <Badge variant="danger">P&D Flag</Badge>
                    )}
                  </div>
                  {signal.title && (
                    <p className="mt-1 break-words text-sm font-medium">
                      {signal.url && /^https?:\/\//.test(signal.url) ? (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          {signal.title}
                        </a>
                      ) : (
                        signal.title
                      )}
                    </p>
                  )}
                </div>
                <div className="ml-4 shrink-0 text-right text-xs text-gray-400">
                  {signal.upvotes != null && <span>{signal.upvotes} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>}
      </Card>
    </div>
  );
}
