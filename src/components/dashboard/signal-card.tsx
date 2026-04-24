"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import { stageLabel } from "@/lib/stage-labels";
import { VoteButton } from "@/components/dashboard/vote-button";

const MAX_TAGS = 2;

const recBorderColors: Record<string, string> = {
  "Strong Buy": "border-emerald-500/70 text-emerald-600 dark:border-emerald-400/50 dark:text-emerald-400",
  Buy: "border-green-500/70 text-green-600 dark:border-green-400/50 dark:text-green-400",
  Watch: "border-amber-500/70 text-amber-600 dark:border-amber-400/50 dark:text-amber-400",
  Avoid: "border-red-500/60 text-red-600 dark:border-red-400/40 dark:text-red-400",
};

// Stage → pill style. Uses semantic stage tokens from globals.css.
const stagePillStyles: Record<string, string> = {
  Emerging: "bg-emerald-500/10 text-stage-early border-emerald-500/30 dark:bg-emerald-400/10",
  Building: "bg-amber-500/10 text-stage-forming border-amber-500/30 dark:bg-amber-400/10",
  Consensus: "bg-blue-500/10 text-stage-confirmed border-blue-500/30 dark:bg-blue-400/10",
  Filtered: "bg-red-500/10 text-stage-filtered border-red-500/30 dark:bg-red-400/10",
  Unscored: "bg-zinc-500/10 text-stage-unscored border-zinc-500/30 dark:bg-zinc-400/10",
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

  return tags;
}


export function SignalCard({
  ticker,
  returnPeriod = "7d",
  variant = "card",
}: {
  ticker: ValidatedTickerData;
  returnPeriod?: string;
  variant?: "card" | "row";
}) {
  const tags = useMemo(() => collectTags(ticker), [ticker]);
  const visibleTags = tags.slice(0, MAX_TAGS);
  const overflow = tags.length - visibleTags.length;
  const overflowList = overflow > 0 ? tags.slice(MAX_TAGS).join(", ") : "";

  const retVal = getReturnValue(ticker, returnPeriod);
  const recClass = ticker.recommendation
    ? recBorderColors[ticker.recommendation] ?? "border-border-strong/60 text-secondary"
    : null;

  const stage = stageLabel(ticker.stage);
  const stageClass = stagePillStyles[stage] ?? stagePillStyles.Unscored;

  const signalCountLabel = ticker.signalCount === 1 ? "signal" : "signals";

  if (variant === "row") {
    return (
      <div className="group relative flex cursor-pointer items-center gap-2 sm:gap-3 rounded-lg border border-border-default/90 bg-card px-3 py-2.5 shadow-sm transition-[border-color,background-color] duration-base hover:border-blue-300 hover:bg-surface-muted dark:hover:border-blue-500/35">
        <Link
          href={`/ticker/${ticker.symbol}`}
          className="absolute inset-0 z-0 rounded-lg"
          aria-label={`Open ${ticker.symbol} detail`}
          draggable={false}
        />
        {/* Stage pill */}
        <span className={`pointer-events-none relative z-1 shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 type-overline ${stageClass}`}>
          {stage}
        </span>
        {/* Symbol + name */}
        <div className="pointer-events-none relative z-1 min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {ticker.symbol}
            </span>
            {recClass && (
              <span className={`hidden sm:inline shrink-0 rounded border-[0.75px] px-1 py-[2px] text-[9px] font-bold uppercase tracking-[0.3px] ${recClass}`}>
                {ticker.recommendation}
              </span>
            )}
            {ticker.name && (
              <span className="hidden truncate type-caption text-secondary sm:block">{ticker.name}</span>
            )}
          </div>
        </div>
        {/* Tags */}
        <div className="pointer-events-none relative z-1 hidden items-center gap-1 md:flex">
          {visibleTags.map((tag, i) => (
            <span key={`${tag}-${i}`} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
              {tag}
            </span>
          ))}
          {overflow > 0 && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">+{overflow}</span>
          )}
        </div>
        {/* Sources */}
        <div className="pointer-events-none relative z-1 hidden shrink-0 items-center gap-1 lg:flex">
          {ticker.sources?.slice(0, 2).map((src) => (
            <span key={src} className="rounded border border-border-default/80 px-1 py-[2px] text-[9px] font-bold uppercase tracking-[0.3px] text-muted">
              {src.replace(/_/g, " ")}
            </span>
          ))}
          {(ticker.sources?.length ?? 0) > 2 && (
            <span className="text-[9px] text-muted">+{(ticker.sources?.length ?? 0) - 2}</span>
          )}
        </div>
        {/* AI score + Opp rank */}
        <div className="pointer-events-none relative z-1 shrink-0 flex items-baseline gap-2">
          <span className="flex items-baseline gap-1">
            <span className="type-overline text-blue-500/70 dark:text-blue-400/60">AI</span>
            <span className="num text-base font-black leading-none text-blue-500 dark:text-blue-400">{ticker.aiScore}</span>
          </span>
          <span className="hidden sm:flex items-baseline gap-0.5">
            <span className="type-overline text-amber-500/70 dark:text-amber-400/60">Opp</span>
            <span className="num text-xs font-bold leading-none text-amber-500 dark:text-amber-400">#{ticker.opportunityScore}</span>
          </span>
        </div>
        {/* Signal count (lg+) */}
        <span className="pointer-events-none relative z-1 hidden shrink-0 items-center gap-1 text-[10px] text-muted lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500" aria-hidden="true" />
          <span className="num font-medium text-secondary">{ticker.signalCount}</span>
          <span>{signalCountLabel}</span>
        </span>
        {/* Price + return + net premium */}
        {ticker.price != null && (
          <div className="pointer-events-none relative z-1 shrink-0 flex flex-col items-end">
            <span className="num text-sm font-semibold text-strong">${ticker.price.toFixed(2)}</span>
            {retVal != null && (
              <span className={`num text-[10px] font-semibold leading-tight ${retVal >= 0 ? "text-green-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {retVal >= 0 ? "+" : ""}{(retVal * 100).toFixed(1)}%
              </span>
            )}
            {ticker.netPremium != null && ticker.netPremium !== 0 && (
              <span
                className={`num text-[10px] font-semibold leading-tight ${ticker.netPremium > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                title={`Net premium flow: ${ticker.netPremium > 0 ? "+" : ""}$${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M${ticker.callPremiumRatio != null ? ` · ${Math.round(ticker.callPremiumRatio * 100)}% calls` : ""}`}
              >
                {ticker.netPremium > 0 ? "+" : ""}${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M
              </span>
            )}
          </div>
        )}
        {/* Vote + chevron */}
        <div className="pointer-events-auto relative z-1 flex shrink-0 items-center gap-2">
          <VoteButton symbol={ticker.symbol} size="sm" />
          <svg className="h-3.5 w-3.5 text-muted transition-colors duration-base group-hover:text-blue-500 dark:group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <Card className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-card-xl border-border-default/90 shadow-card transition-[transform,box-shadow,border-color] duration-base hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-card-hover dark:hover:border-blue-500/35">
      <Link
        href={`/ticker/${ticker.symbol}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Open ${ticker.symbol} detail`}
        draggable={false}
      />
      <CardContent className="pointer-events-none relative z-1 flex flex-1 flex-col gap-3 px-4 py-3 md:px-5 md:py-4">

        {/* Row 1: stage pill (top-left, stays visible) */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 type-overline ${stageClass}`}
          >
            {stage}
          </span>
        </div>

        {/* Row 2: symbol + rec | price + delta */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {ticker.symbol}
              </span>
              {recClass && (
                <span
                  role="status"
                  aria-label={`Recommendation: ${ticker.recommendation}`}
                  className={`shrink-0 rounded border-[0.75px] px-1 py-[3px] text-[10px] font-bold uppercase tracking-[0.3px] ${recClass}`}
                >
                  {ticker.recommendation}
                </span>
              )}
            </div>
            {ticker.name && (
              <p className="line-clamp-1 type-caption text-secondary">{ticker.name}</p>
            )}
          </div>
          {ticker.price != null && (
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <p className="num text-base font-semibold text-strong">
                ${ticker.price.toFixed(2)}
              </p>
              {retVal != null && (
                <span
                  className={`num type-caption font-semibold ${
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

        {/* Row 3: AI hero score | Opp rank (demoted) */}
        <div className="pointer-events-auto flex items-center justify-between gap-3">
          <Tooltip
            side="bottom"
            align="start"
            content="AI confidence (0–100) — evidence strength from sources, sentiment, and corroboration. Not expected upside."
          >
            <span className="flex items-baseline gap-1.5">
              <span className="type-overline text-blue-500/70 dark:text-blue-400/60">AI</span>
              <span className="num text-3xl font-black leading-none text-blue-500 dark:text-blue-400">
                {ticker.aiScore}
              </span>
              <span className="type-caption text-muted">/100</span>
            </span>
          </Tooltip>
          <Tooltip
            side="bottom"
            align="end"
            content="Opportunity rank — early-mover/setup score. Drives list order within a stage."
          >
            <span className="flex items-baseline gap-1 text-right">
              <span className="type-overline text-amber-500/70 dark:text-amber-400/60">Opp</span>
              <span className="num text-sm font-bold leading-none text-amber-500 dark:text-amber-400">
                #{ticker.opportunityScore}
              </span>
            </span>
          </Tooltip>
        </div>

        {/* Row 4: tags — max 2 + overflow */}
        {(visibleTags.length > 0 || overflow > 0) && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1">
            {visibleTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted"
              >
                {tag}
              </span>
            ))}
            {overflow > 0 && (
              <Tooltip side="top" align="start" content={overflowList}>
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
                  +{overflow}
                </span>
              </Tooltip>
            )}
          </div>
        )}

        {/* Footer: sources + signal count + net premium + chevron */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-default/60 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {ticker.sources?.slice(0, 3).map((src) => (
              <span
                key={src}
                className="rounded border border-border-default/80 px-1 py-[3px] text-[9px] font-bold uppercase tracking-[0.3px] text-muted"
              >
                {src.replace(/_/g, " ")}
              </span>
            ))}
            {(ticker.sources?.length ?? 0) > 3 && (
              <span className="text-[9px] text-muted">
                +{(ticker.sources?.length ?? 0) - 3}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500"
                aria-hidden="true"
              />
              <span className="num font-medium text-secondary">{ticker.signalCount}</span>
              <span>{signalCountLabel}</span>
            </span>
            {ticker.netPremium != null && ticker.netPremium !== 0 && (
              <span
                className={`num flex items-center gap-1 text-[10px] font-semibold ${
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

          <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
            <VoteButton symbol={ticker.symbol} size="sm" />
            <svg
              className="h-4 w-4 text-muted transition-colors duration-base group-hover:text-blue-500 dark:group-hover:text-blue-400"
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
