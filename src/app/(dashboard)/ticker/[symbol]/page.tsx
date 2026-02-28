"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTickerDetail, useTickerHistory } from "@/hooks/use-scans";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Sparkline } from "@/components/ui/sparkline";

export default function TickerDetailPage() {
  const router = useRouter();
  const { symbol } = useParams<{ symbol: string }>();
  const { data, isLoading, error } = useTickerDetail(symbol);
  const { data: historyData } = useTickerHistory(symbol);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);

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
        <Badge variant={ticker.stage === "CONFIRMED" ? "success" : ticker.stage === "FORMING" ? "warning" : "info"}>
          {ticker.stage}
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
            <div className="flex justify-between">
              <span className="text-gray-500">Price</span>
              <span className="font-medium">
                {ticker.price ? `$${ticker.price.toFixed(2)}` : "N/A"}
              </span>
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
            <div className="rounded-md bg-blue-50 p-3">
              <p className="text-sm text-blue-900">
                <span className="mr-1 font-semibold">Thesis:</span>
                {ticker.catalyst || "No catalyst data available."}
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
          </CardContent>
        </Card>
      </div>

      {ticker.report && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">AI Analysis Report</h3>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-gray-700">
              {ticker.report.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Score</th>
                      <th className="pb-2 pr-4 font-medium">Stage</th>
                      <th className="pb-2 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...historyData.history].reverse().map((h) => (
                      <tr key={h.scanId} className="border-b border-gray-50">
                        <td className="py-1.5 pr-4 text-gray-600">
                          {new Date(h.startedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-1.5 pr-4 font-semibold text-blue-600">
                          {h.aiScore}
                        </td>
                        <td className="py-1.5 pr-4">
                          <Badge
                            variant={
                              h.stage === "CONFIRMED"
                                ? "success"
                                : h.stage === "FORMING"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            {h.stage}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-gray-600">
                          {h.price ? `$${h.price.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                      {signal.url ? (
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
