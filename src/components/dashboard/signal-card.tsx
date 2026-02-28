"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidatedTickerData } from "@/hooks/use-scans";

const stageColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  CONFIRMED: "success",
  FORMING: "warning",
  EARLY: "info",
  FILTERED: "danger",
};

const recColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  "Strong Buy": "success",
  Buy: "success",
  Watch: "warning",
  Avoid: "danger",
};

export function SignalCard({
  ticker,
  onTrack,
}: {
  ticker: ValidatedTickerData;
  onTrack?: (symbol: string, price: number) => void;
}) {
  return (
    <Card className="group relative flex h-full cursor-pointer flex-col transition-all hover:border-blue-300 hover:shadow-md">
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/ticker/${ticker.symbol}`}
              className="text-lg font-bold text-gray-900 after:absolute after:inset-0 group-hover:text-blue-600"
            >
              {ticker.symbol}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={stageColors[ticker.stage] || "default"}>
                {ticker.stage}
              </Badge>
              {ticker.recommendation && (
                <Badge variant={recColors[ticker.recommendation] || "default"}>
                  {ticker.recommendation}
                </Badge>
              )}
              {ticker.firstSeenDaysAgo === null && (
                <Badge variant="success">NEW</Badge>
              )}
              {ticker.priorAppearances >= 3 && (
                <Badge variant="default">
                  Seen {ticker.priorAppearances}x
                </Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            {ticker.price && (
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-lg font-semibold">
                  ${ticker.price.toFixed(2)}
                </p>
                {ticker.return7d != null && (
                  <span
                    className={`rounded px-1 py-0.5 text-xs font-medium ${
                      ticker.return7d > 0
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {ticker.return7d > 0 ? "+" : ""}
                    {(ticker.return7d * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500">
              Score: {ticker.aiScore}/100
            </p>
          </div>
        </div>

        {ticker.catalyst && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Thesis:</span> {ticker.catalyst}
          </p>
        )}
        {ticker.risks && (
          <p className="text-sm text-amber-700">
            <span className="font-medium">Risks:</span> {ticker.risks}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {ticker.sources?.length > 0 && (
            <span>
              <span className="font-medium">Sources:</span>{" "}
              {ticker.sources.map((s) => s.replace("_", " ")).join(", ")}
            </span>
          )}
          {ticker.shortFloat != null && (
            <span>
              <span className="font-medium">Short float:</span>{" "}
              {(ticker.shortFloat * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
          <span>
            {ticker.signalCount} signals
          </span>
          <div className="flex items-center gap-2">
            {onTrack && ticker.price && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTrack(ticker.symbol, ticker.price!);
                }}
                className="relative z-10 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Add position
              </button>
            )}
            <svg
              className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
