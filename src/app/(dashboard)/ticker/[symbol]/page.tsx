"use client";

import { useParams } from "next/navigation";
import { useTickerDetail } from "@/hooks/use-scans";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function TickerDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { data, isLoading, error } = useTickerDetail(symbol);

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">{ticker.symbol}</h1>
        <Badge variant={ticker.stage === "CONFIRMED" ? "success" : ticker.stage === "FORMING" ? "warning" : "info"}>
          {ticker.stage}
        </Badge>
        {ticker.recommendation && (
          <Badge variant={ticker.recommendation === "Avoid" ? "danger" : "success"}>
            {ticker.recommendation}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Signals ({signals.length})</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start justify-between rounded-lg border border-gray-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{signal.source}</Badge>
                    {signal.pndFlagged && (
                      <Badge variant="danger">P&D Flag</Badge>
                    )}
                  </div>
                  {signal.title && (
                    <p className="mt-1 truncate text-sm font-medium">
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
                <div className="ml-4 text-right text-xs text-gray-400">
                  {signal.upvotes != null && <span>{signal.upvotes} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
