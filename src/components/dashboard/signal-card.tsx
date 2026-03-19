"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import { stageLabel } from "@/lib/stage-labels";

const MAX_SECONDARY_BADGES = 4;

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

type TagVariant = "success" | "warning" | "info" | "danger";

function getReturnValue(ticker: ValidatedTickerData, period: string): number | null | undefined {
  switch (period) {
    case "1d":
      return ticker.return1d;
    case "3d":
      return ticker.return3d;
    case "7d":
      return ticker.return7d;
    case "30d":
      return ticker.return30d;
    default:
      return ticker.return7d;
  }
}

function collectSecondaryTags(ticker: ValidatedTickerData): { label: string; variant: TagVariant }[] {
  const tags: { label: string; variant: TagVariant }[] = [];

  if (ticker.firstSeenDaysAgo === null) {
    tags.push({ label: "NEW", variant: "success" });
  }
  if (
    ticker.price != null &&
    ticker.wk52Hi != null &&
    ticker.wk52Hi > 0 &&
    ticker.price / ticker.wk52Hi >= 0.95
  ) {
    tags.push({ label: "Momentum", variant: "success" });
  }
  if (
    ticker.price != null &&
    ticker.wk52Lo != null &&
    ticker.wk52Lo > 0 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo >= 0.007 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo < 0.5
  ) {
    tags.push({ label: "Near 52W Low", variant: "success" });
  }
  if (
    ticker.shortFloat != null &&
    ticker.shortFloat >= 0.15 &&
    ticker.price != null &&
    ticker.price < 5 &&
    ticker.exchange != null &&
    (ticker.exchange.toLowerCase().includes("american") ||
      ticker.exchange.toLowerCase().includes("nasdaqcm") ||
      ticker.exchange.toLowerCase().includes("nasdaq capital"))
  ) {
    tags.push({ label: "Short Squeeze", variant: "danger" });
  }
  if (ticker.shortFloat != null && ticker.shortFloat >= 0.075 && ticker.shortFloat < 0.15) {
    tags.push({ label: "High SI", variant: "warning" });
  }
  if (ticker.avgVelocity != null && ticker.avgVelocity >= 2.5) {
    tags.push({ label: "High Velocity", variant: "info" });
  }
  if (
    ticker.price != null &&
    ticker.wk52Hi != null &&
    ticker.wk52Lo != null &&
    ticker.wk52Lo > 0 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo < 0.3 &&
    ticker.wk52Hi / ticker.price > 3.0
  ) {
    tags.push({ label: "Recovery", variant: "success" });
  }
  if (ticker.subredditCount != null && ticker.subredditCount >= 3) {
    tags.push({ label: "Multi-Reddit", variant: "info" });
  }
  if (ticker.exchange?.toLowerCase().includes("american") && ticker.price != null && ticker.price < 5) {
    tags.push({ label: "AMEX", variant: "info" });
  }
  if (
    ticker.exchange != null &&
    (ticker.exchange.toLowerCase().includes("nasdaqcm") ||
      ticker.exchange.toLowerCase().includes("nasdaq capital")) &&
    ticker.price != null &&
    ticker.price < 5
  ) {
    tags.push({ label: "NasdaqCM", variant: "info" });
  }
  if (ticker.priorAppearances >= 3) {
    tags.push({ label: `Seen ${ticker.priorAppearances}x`, variant: "warning" });
  }
  if (ticker.pndFlagged) {
    tags.push({ label: "P&D Risk", variant: "danger" });
  }

  return tags;
}

function SignalCountChip({ count }: { count: number }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-gray-50/95 px-2.5 py-1.5 dark:border-zinc-700/70 dark:bg-zinc-900/65"
      aria-label={`${count} raw signals in scan`}
    >
      <svg
        className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <rect x="5" y="14" width="3" height="6" rx="1" opacity={0.35} />
        <rect x="10.5" y="10" width="3" height="10" rx="1" opacity={0.55} />
        <rect x="16" y="6" width="3" height="14" rx="1" />
      </svg>
      <div className="flex min-w-0 items-baseline gap-1.5 leading-none">
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
          {count}
        </span>
        <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">signals</span>
      </div>
    </div>
  );
}

function ScoreMeter({
  label,
  value,
  title,
}: {
  label: string;
  value: number;
  title?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="min-w-0" title={title}>
      <div className="mb-1 flex items-center justify-between gap-1.5 text-[11px] leading-tight">
        <span className="truncate text-gray-500 dark:text-zinc-400">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-gray-800 dark:text-zinc-100">
          {value}/100
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/90 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-blue-500 dark:bg-blue-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
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
  const secondaryTags = useMemo(() => collectSecondaryTags(ticker), [ticker]);
  const visibleSecondary = secondaryTags.slice(0, MAX_SECONDARY_BADGES);
  const overflow = secondaryTags.length - visibleSecondary.length;
  const overflowTitle =
    overflow > 0 ? secondaryTags.slice(MAX_SECONDARY_BADGES).map((t) => t.label).join(", ") : undefined;

  const retVal = getReturnValue(ticker, returnPeriod);

  return (
    <Card className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-gray-200/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-zinc-800/90 dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:hover:border-blue-500/35 dark:hover:shadow-lg dark:hover:shadow-black/40">
      <Link
        href={`/ticker/${ticker.symbol}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Open ${ticker.symbol} detail`}
      />
      <CardContent className="pointer-events-none relative z-1 flex flex-1 flex-col space-y-3 px-4 py-4 md:px-5 md:py-5">
        {/* Row 1: hero symbol + price / return */}
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-2xl font-bold tracking-tight text-gray-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400 sm:text-[1.65rem] sm:leading-none">
            {ticker.symbol}
          </span>
          {ticker.price != null && (
            <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
              <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-100 sm:text-xl">
                ${ticker.price.toFixed(2)}
              </p>
              {retVal != null && (
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${
                    retVal > 0
                      ? "bg-green-50 text-green-700 dark:bg-emerald-950/55 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950/45 dark:text-red-300"
                  }`}
                >
                  {retVal > 0 ? "+" : ""}
                  {(retVal * 100).toFixed(1)}% {RETURN_LABELS[returnPeriod]}
                </span>
              )}
            </div>
          )}
        </div>

        {ticker.name && (
          <p className="line-clamp-1 text-xs text-gray-500 dark:text-zinc-400 sm:text-sm">{ticker.name}</p>
        )}

        {/* Primary status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={stageColors[ticker.stage] || "default"} className="font-semibold">
            {stageLabel(ticker.stage)}
          </Badge>
          {ticker.recommendation && (
            <Badge variant={recColors[ticker.recommendation] || "default"} className="font-semibold">
              {ticker.recommendation}
            </Badge>
          )}
        </div>

        {/* Secondary tags */}
        {(visibleSecondary.length > 0 || overflow > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {visibleSecondary.map((tag, i) => (
              <Badge key={`${tag.label}-${i}`} variant={tag.variant} className="text-[11px]">
                {tag.label}
              </Badge>
            ))}
            {overflow > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-300"
                title={overflowTitle}
              >
                +{overflow} more
              </span>
            )}
          </div>
        )}

        {/* Full-width scores strip (Stitch: side by side) */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/45">
          <ScoreMeter
            label="Opportunity"
            value={ticker.opportunityScore}
            title="Early-mover / opportunity rank — list order uses this (higher = earlier or more favorable setup)."
          />
          <ScoreMeter
            label="Confidence"
            value={ticker.aiScore}
            title="How strong the evidence is (sources, sentiment, corroboration). Not the same as expected upside — high confidence often means the crowd already agrees."
          />
        </div>

        {/* Body: thesis + risks */}
        {(ticker.catalyst || ticker.risks) && (
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-zinc-800/60">
            {ticker.catalyst && (
              <p className="line-clamp-2 text-xs text-gray-700 dark:text-zinc-300 sm:text-sm sm:line-clamp-3">
                <span className="font-semibold text-gray-800 dark:text-zinc-200">Thesis:</span>{" "}
                {ticker.catalyst}
              </p>
            )}
            {ticker.risks && (
              <p className="line-clamp-2 text-xs text-amber-800 dark:text-amber-200/90 sm:text-sm sm:line-clamp-3">
                <span className="font-semibold">Risks:</span> {ticker.risks}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
          {ticker.sources?.length > 0 && (
            <span>
              <span className="font-medium text-gray-600 dark:text-zinc-300">Sources:</span>{" "}
              {ticker.sources.map((s) => s.replace("_", " ")).join(", ")}
            </span>
          )}
          {ticker.shortFloat != null && (
            <span>
              <span className="font-medium text-gray-600 dark:text-zinc-300">Short float:</span>{" "}
              {(ticker.shortFloat * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 pointer-events-none dark:border-zinc-800/60">
          <SignalCountChip count={ticker.signalCount} />
          <div className="flex shrink-0 items-center gap-1">
            {onToggle && (
              <button
                type="button"
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark ticker"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(ticker.symbol, isBookmarked);
                }}
                className="-m-1 rounded p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 pointer-events-auto"
              >
                {isBookmarked ? (
                  <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-gray-300 transition-colors hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-400"
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
            )}
            <svg
              className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-500 dark:text-zinc-600 dark:group-hover:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
