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
  isBookmarked = false,
  onToggle,
}: {
  ticker: ValidatedTickerData;
  isBookmarked?: boolean;
  onToggle?: (symbol: string, currentlyBookmarked: boolean) => void;
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
            {onToggle && (
              <button
                type="button"
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark ticker"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(ticker.symbol, isBookmarked);
                }}
                className="relative z-10 rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {isBookmarked ? (
                  <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-gray-300 transition-colors hover:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                )}
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
