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
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-gray-50/95 px-2.5 py-1 dark:border-zinc-700/70 dark:bg-zinc-900/65"
      aria-label={`${count} raw signals in scan`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" aria-hidden="true" />
      <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{count}</span>
      <span className="text-[11px] text-gray-500 dark:text-zinc-400">signals</span>
    </div>
  );
}

// Arc gauge: semicircle M 8 36 A 32 32 0 0 1 72 36 (cx=40, cy=36, r=32)
const ARC_LENGTH = Math.PI * 32; // ≈100.5

function ArcGauge({
  value,
  type,
  title,
}: {
  value: number;
  type: "opportunity" | "confidence";
  title?: string;
}) {
  const fill = (Math.min(Math.max(value, 0), 100) / 100) * ARC_LENGTH;
  const fillColor = type === "opportunity" ? "#f59e0b" : "#3b82f6";
  const labelClass =
    type === "opportunity"
      ? "text-amber-600 dark:text-amber-400"
      : "text-blue-600 dark:text-blue-400";

  return (
    <div className="flex min-w-0 flex-col items-center gap-0" title={title}>
      <svg width="80" height="38" viewBox="0 1 80 38" aria-hidden="true">
        {/* Track */}
        <path
          d="M 8 36 A 32 32 0 0 1 72 36"
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-zinc-700"
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 8 36 A 32 32 0 0 1 72 36"
          fill="none"
          stroke={fillColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${fill} ${ARC_LENGTH}`}
        />
      </svg>
      <span className="-mt-1 text-sm font-bold tabular-nums leading-none text-gray-900 dark:text-zinc-100">
        {value}
      </span>
      <span className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
        {type === "opportunity" ? "Opp" : "Conf"}
      </span>
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
      {/* Gradient accent bar — dark mode */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-[3px] rounded-l-xl dark:block"
        style={{ background: "linear-gradient(to bottom, #afc6ff, #4edea3)" }}
        aria-hidden="true"
      />
      <Link
        href={`/ticker/${ticker.symbol}`}
        className="absolute right-0 bottom-0 z-0 h-full w-full rounded-xl"
        aria-label={`Open ${ticker.symbol} detail`}
        draggable={false}
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

        {/* Score gauges */}
        <div className="flex items-start justify-center gap-4 rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-900/45">
          <ArcGauge
            value={ticker.opportunityScore}
            type="opportunity"
            title="Early-mover / opportunity rank — list order uses this (higher = earlier or more favorable setup)."
          />
          <ArcGauge
            value={ticker.aiScore}
            type="confidence"
            title="How strong the evidence is (sources, sentiment, corroboration). Not the same as expected upside — high confidence often means the crowd already agrees."
          />
        </div>

        {/* Body: thesis + risks — or hint to open ticker to generate AI analysis */}
        {ticker.catalyst || ticker.risks ? (
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-zinc-800/60">
            {ticker.catalyst && (
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500/70 dark:text-[#afc6ff]/60">
                  Thesis
                </p>
                <p className="line-clamp-2 text-xs leading-relaxed text-gray-700 dark:text-zinc-300 sm:text-sm sm:line-clamp-3">
                  {ticker.catalyst}
                </p>
              </div>
            )}
            {ticker.risks && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-2 dark:bg-amber-950/30 dark:ring-1 dark:ring-amber-500/20">
                <svg
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                <p className="line-clamp-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200/80 sm:line-clamp-2">
                  <span className="font-semibold">Risks:</span>{" "}
                  {ticker.risks}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-blue-200/80 bg-linear-to-br from-blue-50/90 via-slate-50/40 to-transparent px-3 py-2.5 dark:border-blue-500/25 dark:from-blue-950/40 dark:via-zinc-900/30 dark:to-transparent">
            <div className="flex gap-2.5">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-200/80 bg-white/90 shadow-[0_1px_2px_rgba(37,99,235,0.08)] dark:border-blue-500/30 dark:bg-zinc-900/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                aria-hidden
              >
                <svg
                  className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800/90 dark:text-blue-300/95">
                  AI analysis
                </p>
                <p className="text-xs leading-snug text-gray-600 dark:text-zinc-400">
                  Thesis and risks aren&apos;t on this card yet. Pro subscribers can{" "}
                  <span className="font-medium text-blue-700 dark:text-blue-400/95">
                    open the ticker
                  </span>{" "}
                  to generate the technical write-up.
                </p>
              </div>
            </div>
          </div>
        )}

        {(ticker.sources?.length > 0 || ticker.shortFloat != null) && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-zinc-500">
            {ticker.sources?.length > 0 && (
              <span className="min-w-0 truncate uppercase tracking-wide">
                {ticker.sources.map((s) => s.replace(/_/g, " ")).join(" · ")}
              </span>
            )}
            {ticker.shortFloat != null && (
              <span className="shrink-0">
                Short float: {(ticker.shortFloat * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 pointer-events-none dark:border-zinc-800/60">
          <SignalCountChip count={ticker.signalCount} />
          <div className="flex shrink-0 items-center gap-1">
            {onToggle ? (
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
            ) : (
              <a
                href="/login"
                title="Sign in to bookmark"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = "/login"; }}
                className="-m-1 rounded p-1.5 pointer-events-auto opacity-40 hover:opacity-70 transition-opacity"
              >
                <svg className="h-4 w-4 text-gray-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </a>
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
