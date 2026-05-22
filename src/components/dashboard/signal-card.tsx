"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { TrendingTicker } from "@/hooks/use-trending";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import {
  type SignalRowSortDir,
  type SignalRowSortKey,
} from "@/lib/signal-row-sort";
import { sortButtonAriaLabel } from "@/lib/signal-row-sort-labels";
import { recommendationLevels, signalSources, signalStages } from "@/lib/methodology-data";
import { stageLabel } from "@/lib/stage-labels";
import { VoteButton } from "@/components/dashboard/vote-button";

const SOURCE_METH_NAME: Record<string, string> = {
  REDDIT: "Reddit",
  TWITTER: "X / Twitter",
  SEC_INSIDER: "SEC Insider",
  SEC_FILING: "SEC Filing",
  CONGRESS: "Congress",
  OPTIONS_FLOW: "Options Flow",
  VOLUME_SPIKE: "Volume Spike",
  STOCKTWITS: "StockTwits",
  POLYMARKET: "Polymarket",
};

const STAGE_TOOLTIP_BY_DISPLAY = Object.fromEntries(
  signalStages.map((row) => [stageLabel(row.stage), row.desc]),
) as Record<string, string>;

const REC_TOOLTIP_BY_LEVEL = Object.fromEntries(
  recommendationLevels.map((row) => [row.level, row.desc]),
) as Record<string, string>;

const SOURCE_TOOLTIP_BY_ENUM = Object.fromEntries(
  Object.entries(SOURCE_METH_NAME).map(([enumKey, name]) => {
    const row = signalSources.find((s) => s.name === name);
    return [enumKey, row?.description ?? enumKey.replace(/_/g, " ")];
  }),
) as Record<string, string>;

const TAG_TOOLTIPS: Record<string, string> = {
  New: "First appearance in SignalScope — no prior scan history.",
  "Near 52W Low": "Price is just above the 52-week low — potential recovery setup.",
  Momentum: "Trading within 5% of the 52-week high — strength but less early.",
  "Short Squeeze": "High short float on a sub-$5 name — squeeze potential if volume arrives.",
  "High SI": "Elevated short interest (7.5–15%) — watch for squeeze or dilution risk.",
  "High Velocity": "Mentions accelerating quickly across sources in this scan.",
  Recovery: "Deep drawdown from highs with room to re-rate if catalyst lands.",
  "Multi-Reddit": "Mentioned across 3+ subreddits — broader retail discovery.",
  "P&D Risk": "Pump-and-dump flags triggered — treat with extra skepticism.",
  "Bullish Flow": "Net call premium exceeds puts — options market leaning bullish.",
  "Bearish Flow": "Net put premium exceeds calls — options market leaning bearish.",
};

const AI_SCORE_TIP =
  "AI confidence (0–100) — evidence strength from sources, sentiment, and corroboration. Not expected upside.";
const OPP_SCORE_TIP =
  "Opportunity rank — early-mover/setup score. Drives list order within a stage.";
const NET_PREMIUM_TIP =
  "Net options premium flow: call dollar volume minus put dollar volume. Positive = bullish institutional positioning.";

function tagTooltip(tag: string, ticker: ValidatedTickerData): string {
  if (tag.startsWith("Seen ")) {
    return `Seen in ${ticker.priorAppearances} prior scans — repeats without a new catalyst often mean less remaining upside.`;
  }
  return TAG_TOOLTIPS[tag] ?? tag;
}

function netPremiumTooltip(ticker: ValidatedTickerData): string {
  const callPct =
    ticker.callPremiumRatio != null
      ? ` ${Math.round(ticker.callPremiumRatio * 100)}% of premium is calls.`
      : "";
  return `${NET_PREMIUM_TIP}${callPct}`;
}

function returnTooltip(period: string): string {
  return `Price change since detection (${period} window) from scan snapshot bars.`;
}

function CardChevron() {
  return (
    <svg
      className="h-3.5 w-3.5 text-muted transition-colors duration-base group-hover:text-blue-500 dark:group-hover:text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

const MAX_TAGS = 2;

export type SignalCardTrendingMeta = Pick<TrendingTicker, "trend" | "appearanceCount">;

const trendConfig: Record<
  SignalCardTrendingMeta["trend"],
  { icon: string; classes: string; label: string; tip: string }
> = {
  rising: {
    icon: "↑",
    classes: "text-emerald-600 dark:text-emerald-400",
    label: "Rising",
    tip: "AI confidence trend is improving across recent scans.",
  },
  stable: {
    icon: "→",
    classes: "text-gray-500 dark:text-zinc-400",
    label: "Stable",
    tip: "AI confidence is flat across recent scans.",
  },
  falling: {
    icon: "↓",
    classes: "text-rose-600 dark:text-rose-400",
    label: "Falling",
    tip: "AI confidence trend is declining across recent scans.",
  },
};

function appearanceHeat(count: number): string {
  if (count >= 6) return "bg-orange-500/15 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400";
  if (count >= 4) return "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400";
  return "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400";
}

function TrendingCardHeader({ trending }: { trending: SignalCardTrendingMeta }) {
  const cfg = trendConfig[trending.trend];
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 pb-1 pt-1.5">
      <Tooltip side="bottom" align="start" content={cfg.tip}>
        <span className={`text-[11px] font-semibold ${cfg.classes}`}>
          <span className="mr-0.5">{cfg.icon}</span>
          {cfg.label}
        </span>
      </Tooltip>
      <Tooltip
        side="bottom"
        align="start"
        content={`Appeared in ${trending.appearanceCount} completed scans in the last 30 days.`}
      >
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${appearanceHeat(trending.appearanceCount)}`}>
          {trending.appearanceCount}×
        </span>
      </Tooltip>
    </div>
  );
}

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

const stageBarColors: Record<string, string> = {
  Emerging: "bg-emerald-500",
  Building:  "bg-amber-500",
  Consensus: "bg-blue-500",
  Filtered:  "bg-red-500",
  Unscored:  "bg-zinc-400",
};

const tagStyleMap: Record<string, string> = {
  "P&D Risk":     "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
  "New":          "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400",
  "Bullish Flow": "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  "Bearish Flow": "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400",
  "Short Squeeze":"bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  "Momentum":     "bg-blue-500/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  "Near 52W Low": "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  "High Velocity":"bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-400",
  "Recovery":     "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400",
  "Multi-Reddit": "bg-purple-500/10 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  "High SI":      "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
};

function SignalDot({ stage }: { stage: string }) {
  if (stage === "Emerging") {
    return (
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" style={{ animationDuration: "2.5s" }} />
        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
    );
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500" aria-hidden="true" />;
}

function getReturnValue(ticker: ValidatedTickerData, period: string): number | null | undefined {
  switch (period) {
    case "1d": return ticker.return1d;
    case "3d": return ticker.return3d;
    case "7d": return ticker.return7d;
    case "14d": return ticker.return14d;
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


/** Shared grid for row variant — keeps columns aligned across rows. */
export function signalRowGridClass(showStageColumn: boolean) {
  const stage = showStageColumn ? "5rem_" : "";
  return [
    "grid w-full items-center gap-x-3",
    showStageColumn
      ? `grid-cols-[minmax(8.5rem,1.15fr)_4.25rem_${stage}minmax(5.5rem,7.5rem)_minmax(4.5rem,6rem)_2.5rem_3rem_4.5rem_3.75rem_3rem_3rem_2.25rem]`
      : "grid-cols-[minmax(8.5rem,1.15fr)_4.25rem_minmax(5.5rem,7.5rem)_minmax(4.5rem,6rem)_2.5rem_3rem_4.5rem_3.75rem_3rem_3rem_2.25rem]",
  ].join(" ");
}

function RowCell({
  children,
  className = "",
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      role="cell"
      className={`min-w-0 ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function SignalRowHeaderCell({
  children,
  className = "",
  align = "left",
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  sortKey?: SignalRowSortKey;
  activeSortKey?: SignalRowSortKey | null;
  sortDir?: SignalRowSortDir;
  onSort?: (key: SignalRowSortKey) => void;
  ariaLabel?: string;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const justifyClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  if (sortKey && onSort) {
    const isActive = activeSortKey === sortKey;
    return (
      <div
        role="columnheader"
        aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`min-w-0 ${alignClass} ${className}`}
      >
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-label={sortButtonAriaLabel(sortKey, isActive, sortDir ?? "desc")}
          className={`group/col flex w-full min-w-0 items-center gap-0.5 type-overline text-muted transition-colors hover:text-primary ${justifyClass}`}
        >
          <span className="truncate">{children}</span>
          <span
            className={`num shrink-0 text-[9px] leading-none ${isActive ? "text-blue-500 dark:text-blue-400" : "text-transparent group-hover/col:text-muted/60"}`}
            aria-hidden="true"
          >
            {isActive && sortDir === "asc" ? "↑" : "↓"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="columnheader"
      aria-label={ariaLabel}
      className={`min-w-0 ${alignClass} ${className}`}
    >
      <span className={`type-overline truncate text-muted ${alignClass}`}>
        {children}
      </span>
    </div>
  );
}

export function SignalRowHeader({
  returnPeriod = "7d",
  showStageColumn = false,
  sortKey = null,
  sortDir = "desc",
  onSort,
}: {
  returnPeriod?: string;
  showStageColumn?: boolean;
  sortKey?: SignalRowSortKey | null;
  sortDir?: SignalRowSortDir;
  onSort?: (key: SignalRowSortKey) => void;
}) {
  return (
    <div role="row" className={`${signalRowGridClass(showStageColumn)} px-3 pb-0.5`}>
      <SignalRowHeaderCell sortKey="symbol" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Ticker
      </SignalRowHeaderCell>
      <SignalRowHeaderCell sortKey="recommendation" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Rec
      </SignalRowHeaderCell>
      {showStageColumn && (
        <SignalRowHeaderCell sortKey="stage" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
          Stage
        </SignalRowHeaderCell>
      )}
      <SignalRowHeaderCell ariaLabel="Tags, not sortable">Tags</SignalRowHeaderCell>
      <SignalRowHeaderCell sortKey="sources" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        # Src
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="aiScore" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        AI
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="opportunityScore" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Opp
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="signalCount" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Signals
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="price" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Price
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="return" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        {returnPeriod}
      </SignalRowHeaderCell>
      <SignalRowHeaderCell align="right" sortKey="netPremium" activeSortKey={sortKey} sortDir={sortDir} onSort={onSort}>
        Flow
      </SignalRowHeaderCell>
      <div role="columnheader" aria-label="Actions" className="sr-only">
        Actions
      </div>
    </div>
  );
}

function SignalRowMobile({
  ticker,
  returnPeriod,
  retVal,
  trending,
}: {
  ticker: ValidatedTickerData;
  returnPeriod: string;
  retVal: number | null | undefined;
  trending?: SignalCardTrendingMeta;
}) {
  const returnColor =
    retVal != null && retVal > 0
      ? "text-green-600 dark:text-emerald-400"
      : retVal != null && retVal < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted";

  const metaParts: string[] = [];
  if (trending) {
    const cfg = trendConfig[trending.trend];
    metaParts.push(`${cfg.label} · ${trending.appearanceCount}×`);
  }
  if (ticker.recommendation) metaParts.push(ticker.recommendation);
  if (ticker.pndFlagged) metaParts.push("P&D Risk");
  metaParts.push(`AI ${ticker.aiScore}`);
  if (ticker.price != null) metaParts.push(`$${ticker.price.toFixed(2)}`);

  return (
    <div className="pointer-events-none relative z-1 flex items-center gap-3 py-2 pl-2 pr-3 md:hidden">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-sm font-semibold text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {ticker.symbol}
          </span>
          {ticker.name && (
            <span className="truncate text-xs text-secondary">{ticker.name}</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {metaParts.join(" · ")}
        </p>
      </div>
      <div className={`shrink-0 text-right text-sm leading-tight ${returnColor}`}>
        {retVal != null ? (
          <p className="num font-semibold">
            {retVal >= 0 ? "+" : ""}{(retVal * 100).toFixed(1)}% {returnPeriod}
          </p>
        ) : (
          <p className="text-xs text-muted">—</p>
        )}
      </div>
      <div className="pointer-events-auto shrink-0">
        <VoteButton symbol={ticker.symbol} size="sm" fetchEnabled={false} />
      </div>
    </div>
  );
}

type SignalCardProps = {
  ticker: ValidatedTickerData;
  returnPeriod?: string;
  variant?: "card" | "row";
  trending?: SignalCardTrendingMeta;
  /** When set, hides the stage pill on cards matching this filter (dashboard stage tab). */
  stageFilter?: string;
  /** When true, reserves a stage column in row view (e.g. mixed-stage watchlist). */
  showStageColumn?: boolean;
};

export function SignalCard({
  ticker,
  returnPeriod = "7d",
  variant = "card",
  trending,
  stageFilter,
  showStageColumn = stageFilter == null,
}: SignalCardProps) {
  const tags = useMemo(() => collectTags(ticker), [ticker]);
  const visibleTags = tags.slice(0, MAX_TAGS);
  const overflow = tags.length - visibleTags.length;
  const overflowList = overflow > 0 ? tags.slice(MAX_TAGS).join(", ") : "";

  const retVal = getReturnValue(ticker, returnPeriod);
  const recClass = ticker.recommendation
    ? recBorderColors[ticker.recommendation] ?? "border-border-strong/60 text-secondary"
    : null;
  const recTip = ticker.recommendation ? REC_TOOLTIP_BY_LEVEL[ticker.recommendation] : undefined;

  const stage = stageLabel(ticker.stage);
  const stageClass = stagePillStyles[stage] ?? stagePillStyles.Unscored;
  const stageTip = STAGE_TOOLTIP_BY_DISPLAY[stage] ?? stage;
  const showStageBadge = stageFilter == null || ticker.stage !== stageFilter;

  const signalCountLabel = ticker.signalCount === 1 ? "signal" : "signals";
  const signalCountTip = `${ticker.signalCount} raw mention${ticker.signalCount === 1 ? "" : "s"} from ${ticker.sourceCount} source${ticker.sourceCount === 1 ? "" : "s"} in this scan.`;

  const sources = ticker.sources ?? [];
  const netPremiumTip =
    ticker.netPremium != null && ticker.netPremium !== 0 ? netPremiumTooltip(ticker) : undefined;

  if (variant === "row") {
    const rowClass = [
      "group relative min-w-0 cursor-pointer overflow-hidden rounded-lg bg-card transition-[background-color] duration-base hover:bg-surface-muted",
      ticker.pndFlagged && "bg-red-500/[0.04] hover:bg-red-500/[0.08] dark:bg-red-950/20 dark:hover:bg-red-950/30",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={rowClass}>
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${stageBarColors[stage] ?? "bg-zinc-400"}`}
          aria-hidden="true"
        />
        <Link
          href={`/ticker/${ticker.symbol}`}
          className="absolute inset-0 z-0 rounded-lg"
          aria-label={`Open ${ticker.symbol} detail`}
          draggable={false}
        />
        <SignalRowMobile
          ticker={ticker}
          returnPeriod={returnPeriod}
          retVal={retVal}
          trending={trending}
        />
        <div
          role="row"
          className={`pointer-events-none relative z-1 hidden md:grid ${signalRowGridClass(showStageColumn)} px-3 py-1.5 pl-3.5`}
        >
          {/* Ticker */}
          <RowCell>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 text-sm font-semibold tracking-tight text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {ticker.symbol}
              </span>
              {ticker.name && (
                <span className="hidden truncate type-caption text-secondary sm:block">{ticker.name}</span>
              )}
            </div>
          </RowCell>
          {/* Rec */}
          <RowCell>
            {recClass && recTip ? (
              <Tooltip side="bottom" align="start" content={recTip}>
                <span className={`pointer-events-auto inline-block max-w-full truncate rounded border-[0.75px] px-1 py-[2px] text-[9px] font-bold uppercase tracking-[0.3px] ${recClass}`}>
                  {ticker.recommendation}
                </span>
              </Tooltip>
            ) : (
              <span className="type-caption text-muted">—</span>
            )}
          </RowCell>
          {/* Stage */}
          {showStageColumn && (
            <RowCell>
              {showStageBadge ? (
                <Tooltip side="bottom" align="start" content={stageTip}>
                  <span className={`pointer-events-auto inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 type-overline ${stageClass}`}>
                    {stage}
                  </span>
                </Tooltip>
              ) : (
                <span className="type-caption text-muted">—</span>
              )}
            </RowCell>
          )}
          {/* Tags */}
          <RowCell className="flex items-center gap-1">
            {visibleTags.length > 0 ? (
              <>
                {visibleTags.map((tag, i) => (
                  <Tooltip key={`${tag}-${i}`} side="top" align="start" content={tagTooltip(tag, ticker)}>
                    <span className={`pointer-events-auto truncate rounded px-1.5 py-0.5 text-[10px] ${tagStyleMap[tag] ?? "bg-surface-muted text-muted"}`}>
                      {tag}
                    </span>
                  </Tooltip>
                ))}
                {overflow > 0 && (
                  <Tooltip side="top" align="start" content={overflowList}>
                    <span className="pointer-events-auto shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">+{overflow}</span>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="type-caption text-muted">—</span>
            )}
          </RowCell>
          {/* Sources — count shown in header as # Src; chips list source names */}
          <RowCell className="flex items-center gap-1">
            {sources.length > 0 ? (
              <>
                {sources.slice(0, 2).map((src) => (
                  <Tooltip key={src} side="top" align="start" content={SOURCE_TOOLTIP_BY_ENUM[src] ?? src.replace(/_/g, " ")}>
                    <span className="pointer-events-auto truncate rounded border border-border-default/80 px-1 py-[2px] text-[10px] font-bold uppercase tracking-[0.3px] text-muted">
                      {src.replace(/_/g, " ")}
                    </span>
                  </Tooltip>
                ))}
                {sources.length > 2 && (
                  <Tooltip
                    side="top"
                    align="start"
                    content={sources.slice(2).map((s) => s.replace(/_/g, " ")).join(", ")}
                  >
                    <span className="pointer-events-auto shrink-0 text-[9px] text-muted">+{sources.length - 2}</span>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="type-caption text-muted">—</span>
            )}
          </RowCell>
          {/* AI */}
          <RowCell align="right">
            <Tooltip side="bottom" align="end" content={AI_SCORE_TIP}>
              <span className="pointer-events-auto num block text-base font-black leading-none text-blue-500 dark:text-blue-400">
                {ticker.aiScore}
              </span>
            </Tooltip>
          </RowCell>
          {/* Opp */}
          <RowCell align="right">
            <Tooltip side="bottom" align="end" content={OPP_SCORE_TIP}>
              <span className="pointer-events-auto num block text-xs font-bold leading-none text-amber-500 dark:text-amber-400">
                #{ticker.opportunityScore}
              </span>
            </Tooltip>
          </RowCell>
          {/* Signals */}
          <RowCell align="right">
            <Tooltip side="top" align="end" content={signalCountTip}>
              <span className="pointer-events-auto flex items-center justify-end gap-1 text-[10px] text-muted">
                <SignalDot stage={stage} />
                <span className="num font-medium text-secondary">{ticker.signalCount}</span>
              </span>
            </Tooltip>
          </RowCell>
          {/* Price */}
          <RowCell align="right">
            <span className="num text-sm font-semibold text-strong">
              {ticker.price != null ? `$${ticker.price.toFixed(2)}` : "—"}
            </span>
          </RowCell>
          {/* Return */}
          <RowCell align="right">
            {retVal != null ? (
              <Tooltip side="top" align="end" content={returnTooltip(returnPeriod)}>
                <span className={`pointer-events-auto num text-xs font-semibold ${retVal >= 0 ? "text-green-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {retVal >= 0 ? "+" : ""}{(retVal * 100).toFixed(1)}%
                </span>
              </Tooltip>
            ) : (
              <span className="type-caption text-muted">—</span>
            )}
          </RowCell>
          {/* Net premium flow */}
          <RowCell align="right">
            {netPremiumTip && ticker.netPremium != null ? (
              <Tooltip side="top" align="end" content={netPremiumTip}>
                <span
                  className={`pointer-events-auto num text-xs font-semibold ${ticker.netPremium > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                >
                  {ticker.netPremium > 0 ? "+" : ""}${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M
                </span>
              </Tooltip>
            ) : (
              <span className="type-caption text-muted">—</span>
            )}
          </RowCell>
          {/* Actions */}
          <RowCell align="right" className="pointer-events-auto flex items-center justify-end">
            <VoteButton symbol={ticker.symbol} size="sm" fetchEnabled={false} />
          </RowCell>
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
      <div className={`pointer-events-none relative z-1 h-0.5 w-full ${stageBarColors[stage] ?? "bg-zinc-400"}`} aria-hidden="true" />
      {trending && (
        <div className="pointer-events-none relative z-1 border-b border-border-default/60">
          <TrendingCardHeader trending={trending} />
        </div>
      )}
      <CardContent className="pointer-events-none relative z-1 flex flex-1 flex-col gap-1.5 px-2.5 py-2 md:px-3 md:py-2">

        {/* Symbol + stage + rec | price + delta */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-1">
              <span className="text-base font-semibold tracking-tight text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {ticker.symbol}
              </span>
              {recClass && recTip && (
                <Tooltip side="bottom" align="start" content={recTip}>
                  <span
                    role="status"
                    aria-label={`Recommendation: ${ticker.recommendation}`}
                    className={`shrink-0 rounded border-[0.75px] px-1 py-[3px] text-[10px] font-bold uppercase tracking-[0.3px] ${recClass}`}
                  >
                    {ticker.recommendation}
                  </span>
                </Tooltip>
              )}
              {showStageBadge && (
                <Tooltip side="bottom" align="start" content={stageTip}>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px type-overline ${stageClass}`}
                  >
                    {stage}
                  </span>
                </Tooltip>
              )}
            </div>
            {ticker.name && (
              <p className="line-clamp-1 type-caption text-secondary">{ticker.name}</p>
            )}
          </div>
          {ticker.price != null && (
            <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-0.5 text-right">
              <p className="num text-sm font-semibold text-strong">
                ${ticker.price.toFixed(2)}
              </p>
              {retVal != null && (
                <Tooltip side="top" align="end" content={returnTooltip(returnPeriod)}>
                  <span
                    className={`num type-caption font-semibold ${
                      retVal >= 0
                        ? "text-green-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {retVal >= 0 ? "+" : ""}{(retVal * 100).toFixed(1)}% {returnPeriod}
                  </span>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Row 3: AI hero score | Opp rank (demoted) */}
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <Tooltip
            side="bottom"
            align="start"
            content={AI_SCORE_TIP}
          >
            <span className="flex items-baseline gap-1">
              <span className="type-overline text-blue-500/70 dark:text-blue-400/60">AI</span>
              <span className="num text-xl font-black leading-none text-blue-500 dark:text-blue-400">
                {ticker.aiScore}
              </span>
              <span className="text-[9px] text-muted">/100</span>
            </span>
          </Tooltip>
          <Tooltip
            side="bottom"
            align="end"
            content={OPP_SCORE_TIP}
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
              <Tooltip key={`${tag}-${i}`} side="top" align="start" content={tagTooltip(tag, ticker)}>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${tagStyleMap[tag] ?? "bg-surface-muted text-muted"}`}
                >
                  {tag}
                </span>
              </Tooltip>
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
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-default/60 pt-1">
          <div className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-1">
            {sources.slice(0, 3).map((src) => (
              <Tooltip key={src} side="top" align="start" content={SOURCE_TOOLTIP_BY_ENUM[src] ?? src.replace(/_/g, " ")}>
                <span className="rounded border border-border-default/80 px-1 py-px text-[10px] font-bold uppercase tracking-[0.3px] text-muted">
                  {src.replace(/_/g, " ")}
                </span>
              </Tooltip>
            ))}
            {sources.length > 3 && (
              <Tooltip
                side="top"
                align="start"
                content={sources.slice(3).map((s) => s.replace(/_/g, " ")).join(", ")}
              >
                <span className="text-[9px] text-muted">+{sources.length - 3}</span>
              </Tooltip>
            )}
            <Tooltip side="top" align="start" content={signalCountTip}>
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <SignalDot stage={stage} />
                <span className="num font-medium text-secondary">{ticker.signalCount}</span>
                <span>{signalCountLabel}</span>
              </span>
            </Tooltip>
            {netPremiumTip && ticker.netPremium != null && (
              <Tooltip side="top" align="start" content={netPremiumTip}>
                <span
                  className={`num flex items-center gap-1 text-[10px] font-semibold ${
                    ticker.netPremium > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {ticker.netPremium > 0 ? "+" : ""}${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M
                </span>
              </Tooltip>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
            <VoteButton symbol={ticker.symbol} size="sm" fetchEnabled={false} />
            <CardChevron />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
