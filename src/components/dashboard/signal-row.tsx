"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/dashboard/vote-button";
import type { ValidatedTickerData } from "@/hooks/use-scans";
import {
  type ReturnPeriod,
  DEFAULT_RETURN_PERIOD,
  getReturnValue,
  returnTooltip,
} from "@/lib/return-period";
import {
  type SignalRowSortDir,
  type SignalRowSortKey,
} from "@/lib/signal-row-sort";
import { sortButtonAriaLabel } from "@/lib/signal-row-sort-labels";
import {
  SIGNAL_ROW_GRID_CLASS,
  signalRowGridStyle,
} from "@/lib/signal-row-grid";
import {
  AI_SCORE_TIP,
  OPP_SCORE_TIP,
  MAX_TAGS,
  REC_TOOLTIP_BY_LEVEL,
  SOURCE_TOOLTIP_BY_ENUM,
  STAGE_TOOLTIP_BY_DISPLAY,
  SignalDot,
  TrendingRowBadge,
  collectTags,
  netPremiumTooltip,
  recBorderColors,
  stageBarColors,
  stagePillStyles,
  tagStyleMap,
  tagTooltip,
  trendConfig,
  type SignalCardTrendingMeta,
} from "@/lib/signal-card-shared";
import { stageLabel } from "@/lib/stage-labels";

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
  sortableKeys,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  sortKey?: SignalRowSortKey;
  activeSortKey?: SignalRowSortKey | null;
  sortDir?: SignalRowSortDir;
  onSort?: (key: SignalRowSortKey) => void;
  /** When set, only keys in this set get sort buttons (e.g. trending API-backed columns). */
  sortableKeys?: ReadonlySet<SignalRowSortKey>;
  ariaLabel?: string;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const justifyClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  const canSort =
    sortKey &&
    onSort &&
    (sortableKeys == null || sortableKeys.has(sortKey));

  if (canSort) {
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
  returnPeriod = DEFAULT_RETURN_PERIOD,
  showStageColumn = false,
  sortKey = null,
  sortDir = "desc",
  onSort,
  sortableKeys,
}: {
  returnPeriod?: ReturnPeriod;
  showStageColumn?: boolean;
  sortKey?: SignalRowSortKey | null;
  sortDir?: SignalRowSortDir;
  onSort?: (key: SignalRowSortKey) => void;
  sortableKeys?: ReadonlySet<SignalRowSortKey>;
}) {
  const cell = (key: SignalRowSortKey | undefined, props: Omit<Parameters<typeof SignalRowHeaderCell>[0], "sortKey" | "activeSortKey" | "sortDir" | "onSort" | "sortableKeys"> & { sortKey?: SignalRowSortKey }) => (
    <SignalRowHeaderCell
      sortKey={props.sortKey ?? key}
      activeSortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      sortableKeys={sortableKeys}
      {...props}
    />
  );

  return (
    <div
      role="row"
      className={`${SIGNAL_ROW_GRID_CLASS} px-3 pb-0.5`}
      style={signalRowGridStyle(showStageColumn)}
    >
      {cell("symbol", { children: "Ticker" })}
      {cell("recommendation", { children: "Rec" })}
      {showStageColumn && cell("stage", { children: "Stage" })}
      <SignalRowHeaderCell ariaLabel="Tags, not sortable">Tags</SignalRowHeaderCell>
      {cell("sources", { children: "# Src" })}
      {cell("aiScore", { align: "right", children: "AI" })}
      {cell("opportunityScore", { align: "right", children: "Opp" })}
      {cell("signalCount", { align: "right", children: "Signals" })}
      {cell("price", { align: "right", children: "Price" })}
      {cell("return", { align: "right", children: returnPeriod })}
      {cell("netPremium", { align: "right", children: "Flow" })}
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
  returnPeriod: ReturnPeriod;
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

export type SignalRowProps = {
  ticker: ValidatedTickerData;
  returnPeriod?: ReturnPeriod;
  trending?: SignalCardTrendingMeta;
  stageFilter?: string;
  showStageColumn?: boolean;
};

export function SignalRow({
  ticker,
  returnPeriod = DEFAULT_RETURN_PERIOD,
  trending,
  stageFilter,
  showStageColumn = stageFilter == null,
}: SignalRowProps) {
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

  const signalCountTip = `${ticker.signalCount} raw mention${ticker.signalCount === 1 ? "" : "s"} from ${ticker.sourceCount} source${ticker.sourceCount === 1 ? "" : "s"} in this scan.`;
  const sources = ticker.sources ?? [];
  const netPremiumTip =
    ticker.netPremium != null && ticker.netPremium !== 0 ? netPremiumTooltip(ticker) : undefined;

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
        className={`pointer-events-none relative z-1 hidden md:grid ${SIGNAL_ROW_GRID_CLASS} px-3 py-1.5 pl-3.5`}
        style={signalRowGridStyle(showStageColumn)}
      >
        <RowCell>
          <div className="flex min-w-0 items-center gap-1.5">
            {trending && <TrendingRowBadge trending={trending} />}
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 text-sm font-semibold tracking-tight text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {ticker.symbol}
              </span>
              {ticker.name && (
                <span className="hidden truncate type-caption text-secondary sm:block">{ticker.name}</span>
              )}
            </div>
          </div>
        </RowCell>
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
        <RowCell align="right">
          <Tooltip side="bottom" align="end" content={AI_SCORE_TIP}>
            <span className="pointer-events-auto num block text-base font-black leading-none text-blue-500 dark:text-blue-400">
              {ticker.aiScore}
            </span>
          </Tooltip>
        </RowCell>
        <RowCell align="right">
          <Tooltip side="bottom" align="end" content={OPP_SCORE_TIP}>
            <span className="pointer-events-auto num block text-xs font-bold leading-none text-amber-500 dark:text-amber-400">
              #{ticker.opportunityScore}
            </span>
          </Tooltip>
        </RowCell>
        <RowCell align="right">
          <Tooltip side="top" align="end" content={signalCountTip}>
            <span className="pointer-events-auto flex items-center justify-end gap-1 text-[10px] text-muted">
              <SignalDot stage={stage} />
              <span className="num font-medium text-secondary">{ticker.signalCount}</span>
            </span>
          </Tooltip>
        </RowCell>
        <RowCell align="right">
          <span className="num text-sm font-semibold text-strong">
            {ticker.price != null ? `$${ticker.price.toFixed(2)}` : "—"}
          </span>
        </RowCell>
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
        <RowCell align="right" className="pointer-events-auto flex items-center justify-end">
          <VoteButton symbol={ticker.symbol} size="sm" fetchEnabled={false} />
        </RowCell>
      </div>
    </div>
  );
}
