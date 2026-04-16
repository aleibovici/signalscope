"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import { stageLabel } from "@/lib/stage-labels";

const MAX_TAGS = 5;

const recBorderColors: Record<string, string> = {
  "Strong Buy": "border-emerald-500/70 text-emerald-600 dark:border-emerald-400/50 dark:text-emerald-400",
  Buy: "border-green-500/70 text-green-600 dark:border-green-400/50 dark:text-green-400",
  Watch: "border-amber-500/70 text-amber-600 dark:border-amber-400/50 dark:text-amber-400",
  Avoid: "border-red-500/60 text-red-600 dark:border-red-400/40 dark:text-red-400",
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

function collectTags(ticker: ValidatedTickerData): string[] {
  const tags: string[] = [];

  if (ticker.priorAppearances >= 3) tags.push(`Seen ${ticker.priorAppearances}x`);
  if (ticker.firstSeenDaysAgo === null) tags.push("New");
  if (
    ticker.price != null && ticker.wk52Lo != null && ticker.wk52Lo > 0 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo >= 0.007 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo < 0.5
  ) tags.push("Near 52W Low");
  if (
    ticker.price != null && ticker.wk52Hi != null && ticker.wk52Hi > 0 &&
    ticker.price / ticker.wk52Hi >= 0.95
  ) tags.push("Momentum");
  if (
    ticker.shortFloat != null && ticker.shortFloat >= 0.15 &&
    ticker.price != null && ticker.price < 5 &&
    ticker.exchange != null &&
    (ticker.exchange.toLowerCase().includes("american") ||
      ticker.exchange.toLowerCase().includes("nasdaqcm") ||
      ticker.exchange.toLowerCase().includes("nasdaq capital"))
  ) tags.push("Short Squeeze");
  if (ticker.shortFloat != null && ticker.shortFloat >= 0.075 && ticker.shortFloat < 0.15) tags.push("High SI");
  if (ticker.avgVelocity != null && ticker.avgVelocity >= 2.5) tags.push("High Velocity");
  if (
    ticker.price != null && ticker.wk52Hi != null && ticker.wk52Lo != null && ticker.wk52Lo > 0 &&
    (ticker.price - ticker.wk52Lo) / ticker.wk52Lo < 0.3 && ticker.wk52Hi / ticker.price > 3.0
  ) tags.push("Recovery");
  if (ticker.subredditCount != null && ticker.subredditCount >= 3) tags.push("Multi-Reddit");
  if (ticker.pndFlagged) tags.push("P&D Risk");
  if (ticker.netPremium != null && ticker.netPremium > 0) tags.push("Bullish Flow");
  if (ticker.netPremium != null && ticker.netPremium < 0) tags.push("Bearish Flow");

  // Stage tag
  const stage = stageLabel(ticker.stage);
  if (stage && !tags.some((t) => t.toLowerCase() === stage.toLowerCase())) tags.push(stage);

  return tags;
}

function ScoreBadge({
  value,
  type,
  title,
}: {
  value: number;
  type: "opportunity" | "confidence";
  title?: string;
}) {
  const isOpp = type === "opportunity";
  const label = isOpp ? "OPP" : "AI";
  const bgClass = isOpp
    ? "bg-amber-500/10 dark:bg-amber-500/10"
    : "bg-blue-500/10 dark:bg-blue-500/10";
  const labelClass = isOpp
    ? "text-amber-500/85 dark:text-amber-400/85"
    : "text-blue-500/85 dark:text-blue-400/85";
  const valueClass = isOpp
    ? "text-amber-500 dark:text-amber-400"
    : "text-blue-500 dark:text-blue-400";

  return (
    <div
      className={`flex w-11 flex-col items-center rounded-md py-1.5 ${bgClass}`}
      title={title}
    >
      <span className={`text-[7px] font-bold uppercase tracking-wide ${labelClass}`}>
        {label}
      </span>
      <span className={`text-base font-black tabular-nums leading-tight ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export function SignalCard({
  ticker,
  returnPeriod = "7d",
}: {
  ticker: ValidatedTickerData;
  returnPeriod?: string;
}) {
  const tags = useMemo(() => collectTags(ticker), [ticker]);
  const visibleTags = tags.slice(0, MAX_TAGS);
  const overflow = tags.length - visibleTags.length;
  const overflowTitle = overflow > 0 ? tags.slice(MAX_TAGS).join(", ") : undefined;

  const retVal = getReturnValue(ticker, returnPeriod);
  const recClass = ticker.recommendation
    ? recBorderColors[ticker.recommendation] ?? "border-gray-400/60 text-gray-500 dark:border-zinc-500/50 dark:text-zinc-400"
    : null;

  return (
    <Card className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-gray-200/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-zinc-800/90 dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:hover:border-blue-500/35 dark:hover:shadow-lg dark:hover:shadow-black/40">
      {/* Gradient accent bar — dark mode only */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-[3px] rounded-l-xl dark:block"
        style={{ background: "linear-gradient(to bottom, #afc6ff, #4edea3)" }}
        aria-hidden="true"
      />
      <Link
        href={`/ticker/${ticker.symbol}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Open ${ticker.symbol} detail`}
        draggable={false}
      />
      <CardContent className="pointer-events-none relative z-1 flex flex-1 flex-col gap-3 px-4 py-4 md:px-5 md:py-4">

        {/* Row 1: symbol + rec badge | price + return */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-gray-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                {ticker.symbol}
              </span>
              {recClass && (
                <span
                  className={`shrink-0 rounded border-[0.75px] px-1 py-[3px] text-[10px] font-bold uppercase tracking-[0.3px] ${recClass}`}
                >
                  {ticker.recommendation}
                </span>
              )}
            </div>
            {ticker.name && (
              <p className="line-clamp-1 text-xs text-gray-500 dark:text-zinc-400">{ticker.name}</p>
            )}
          </div>
          {ticker.price != null && (
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
                ${ticker.price.toFixed(2)}
              </p>
              {retVal != null && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    retVal >= 0
                      ? "text-green-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {retVal >= 0 ? "+" : ""}{(retVal * 100).toFixed(1)}% {RETURN_LABELS[returnPeriod]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Score badges */}
        <div className="flex items-center gap-3">
          <ScoreBadge
            value={ticker.opportunityScore}
            type="opportunity"
            title="Early-mover / opportunity rank — list order uses this (higher = earlier or more favorable setup)."
          />
          <ScoreBadge
            value={ticker.aiScore}
            type="confidence"
            title="How strong the evidence is (sources, sentiment, corroboration). Not the same as expected upside."
          />
        </div>

        {/* Tags: outlined rectangular pills */}
        {(visibleTags.length > 0 || overflow > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {visibleTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded border-[0.75px] border-gray-300/70 px-1 py-[3px] text-[10px] font-bold uppercase tracking-[0.3px] text-gray-500 dark:border-zinc-600/60 dark:text-zinc-400"
              >
                {tag}
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="rounded border-[0.75px] border-gray-300/70 px-1 py-[3px] text-[10px] font-bold text-gray-400 dark:border-zinc-600/60 dark:text-zinc-500"
                title={overflowTitle}
              >
                +{overflow}
              </span>
            )}
          </div>
        )}

        {/* Footer: sources + signals + bookmark */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-zinc-800/60">
          {/* Source chips + signal count */}
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {ticker.sources?.slice(0, 3).map((src) => (
              <span
                key={src}
                className="rounded border-[0.75px] border-gray-200/90 px-1 py-[3px] text-[9px] font-bold uppercase tracking-[0.3px] text-gray-400 dark:border-zinc-700/60 dark:text-zinc-500"
              >
                {src.replace(/_/g, " ")}
              </span>
            ))}
            {(ticker.sources?.length ?? 0) > 3 && (
              <span className="text-[9px] text-gray-400 dark:text-zinc-600">
                +{(ticker.sources?.length ?? 0) - 3}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
              <span
                className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500"
                aria-hidden="true"
              />
              <span className="tabular-nums font-medium text-gray-500 dark:text-zinc-400">{ticker.signalCount}</span>
              <span>signals</span>
            </span>
            {ticker.netPremium != null && ticker.netPremium !== 0 && (
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold tabular-nums ${
                  ticker.netPremium > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
                title={`Net premium flow: ${ticker.netPremium > 0 ? "+" : ""}$${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M${ticker.callPremiumRatio != null ? ` · ${Math.round(ticker.callPremiumRatio * 100)}% calls` : ""}`}
              >
                {ticker.netPremium > 0 ? "+" : ""}${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M
              </span>
            )}
          </div>

          {/* Chevron */}
          <div className="flex shrink-0 items-center pointer-events-auto">
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
