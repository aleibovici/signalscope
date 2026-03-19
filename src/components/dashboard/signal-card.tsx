"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import { stageLabel } from "@/lib/stage-labels";

const stageColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  Emerging: "success",
  Building: "warning",
  Consensus: "info",
  Filtered: "danger",
};

const recColors: Record<string, "success" | "warning" | "info" | "danger"> = {
  "Strong Buy": "success",
  Buy: "success",
  Watch: "warning",
  Avoid: "danger",
};

const RETURN_LABELS: Record<string, string> = {
  "1d": "1d",
  "3d": "3d",
  "7d": "7d",
  "30d": "30d",
};

function getReturnValue(ticker: ValidatedTickerData, period: string): number | null | undefined {
  switch (period) {
    case "1d": return ticker.return1d;
    case "3d": return ticker.return3d;
    case "7d": return ticker.return7d;
    case "30d": return ticker.return30d;
    default: return ticker.return7d;
  }
}

export function SignalCard({
  ticker,
  isBookmarked = false,
  onToggle,
  returnPeriod = "7d",
}: {
  ticker: ValidatedTickerData;
  isBookmarked?: boolean;
  onToggle?: (symbol: string, currentlyBookmarked: boolean) => void;
  returnPeriod?: string;
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
            {ticker.name && (
              <span className="block truncate text-xs text-gray-500 max-w-[140px] sm:max-w-[180px]">{ticker.name}</span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={stageColors[ticker.stage] || "default"}>
                {stageLabel(ticker.stage)}
              </Badge>
              {ticker.recommendation && (
                <Badge variant={recColors[ticker.recommendation] || "default"}>
                  {ticker.recommendation}
                </Badge>
              )}
              {ticker.firstSeenDaysAgo === null && (
                <Badge variant="success">NEW</Badge>
              )}
              {ticker.price != null && ticker.wk52Hi != null && ticker.wk52Hi > 0 &&
               ticker.price / ticker.wk52Hi >= 0.95 && (
                <Badge variant="success">Momentum</Badge>
              )}
              {ticker.price != null && ticker.wk52Lo != null && ticker.wk52Lo > 0 &&
               ((ticker.price - ticker.wk52Lo) / ticker.wk52Lo) >= 0.007 &&
               ((ticker.price - ticker.wk52Lo) / ticker.wk52Lo) < 0.50 && (
                <Badge variant="success">Near 52W Low</Badge>
              )}
              {ticker.shortFloat != null && ticker.shortFloat >= 0.15 &&
               ticker.price != null && ticker.price < 5 &&
               ticker.exchange != null && (
                 ticker.exchange.toLowerCase().includes("american") ||
                 ticker.exchange.toLowerCase().includes("nasdaqcm") ||
                 ticker.exchange.toLowerCase().includes("nasdaq capital")
               ) && (
                <Badge variant="danger">Short Squeeze</Badge>
              )}
              {ticker.shortFloat != null && ticker.shortFloat >= 0.075 && ticker.shortFloat < 0.15 && (
                <Badge variant="warning">High SI</Badge>
              )}
              {ticker.avgVelocity != null && ticker.avgVelocity >= 2.5 && (
                <Badge variant="info">High Velocity</Badge>
              )}
              {ticker.price != null && ticker.wk52Hi != null && ticker.wk52Lo != null && ticker.wk52Lo > 0 &&
               ((ticker.price - ticker.wk52Lo) / ticker.wk52Lo) < 0.30 &&
               ticker.wk52Hi / ticker.price > 3.0 && (
                <Badge variant="success">Recovery</Badge>
              )}
              {ticker.subredditCount != null && ticker.subredditCount >= 3 && (
                <Badge variant="info">Multi-Reddit</Badge>
              )}
              {ticker.exchange?.toLowerCase().includes("american") &&
               ticker.price != null && ticker.price < 5 && (
                <Badge variant="info">AMEX</Badge>
              )}
              {ticker.exchange != null &&
               (ticker.exchange.toLowerCase().includes("nasdaqcm") ||
                ticker.exchange.toLowerCase().includes("nasdaq capital")) &&
               ticker.price != null && ticker.price < 5 && (
                <Badge variant="info">NasdaqCM</Badge>
              )}
              {ticker.priorAppearances >= 3 && (
                <Badge variant="warning">
                  Seen {ticker.priorAppearances}x
                </Badge>
              )}
              {ticker.pndFlagged && (
                <Badge variant="danger">P&D Risk</Badge>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {ticker.price && (
              <div className="flex items-center justify-end gap-1">
                <p className="text-base font-semibold sm:text-lg">
                  ${ticker.price.toFixed(2)}
                </p>
                {(() => {
                  const retVal = getReturnValue(ticker, returnPeriod);
                  if (retVal == null) return null;
                  return (
                    <span
                      className={`rounded px-1 py-0.5 text-xs font-medium ${
                        retVal > 0
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {retVal > 0 ? "+" : ""}
                      {(retVal * 100).toFixed(1)}% {RETURN_LABELS[returnPeriod]}
                    </span>
                  );
                })()}
              </div>
            )}
            <div className="space-y-0.5 text-right text-xs leading-tight">
              <p title="Early-mover / opportunity rank — list order uses this (higher = earlier or more favorable setup).">
                <span className="text-gray-500">Opportunity</span>{" "}
                <span className="font-semibold text-gray-800">
                  {ticker.opportunityScore}/100
                </span>
              </p>
              <p
                className="text-gray-500"
                title="How strong the evidence is (sources, sentiment, corroboration). Not the same as expected upside — high confidence often means the crowd already agrees."
              >
                <span>Confidence</span>{" "}
                <span className="font-medium text-gray-700">{ticker.aiScore}/100</span>
              </p>
            </div>
          </div>
        </div>

        {ticker.catalyst && (
          <p className="line-clamp-2 text-xs text-gray-700 sm:text-sm sm:line-clamp-3">
            <span className="font-medium">Thesis:</span> {ticker.catalyst}
          </p>
        )}
        {ticker.risks && (
          <p className="line-clamp-2 text-xs text-amber-700 sm:text-sm sm:line-clamp-3">
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
                className="relative z-10 rounded p-1.5 -m-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
