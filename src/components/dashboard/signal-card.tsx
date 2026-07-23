"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/dashboard/vote-button";
import { SignalRow, type SignalRowProps } from "@/components/dashboard/signal-row";
import {
  DEFAULT_RETURN_PERIOD,
  getReturnValue,
  returnTooltip,
} from "@/lib/return-period";
import {
  AI_SCORE_TIP,
  OPP_SCORE_TIP,
  MAX_TAGS,
  REC_TOOLTIP_BY_LEVEL,
  SOURCE_TOOLTIP_BY_ENUM,
  STAGE_TOOLTIP_BY_DISPLAY,
  SignalDot,
  TrendingCardHeader,
  collectTags,
  netPremiumTooltip,
  recBorderColors,
  stageBarColors,
  stagePillStyles,
  tagStyleMap,
  tagTooltip,
  type SignalCardTrendingMeta,
} from "@/lib/signal-card-shared";
import { stageLabel } from "@/lib/stage-labels";

export type { SignalCardTrendingMeta };
export { SignalRowHeader } from "@/components/dashboard/signal-row";

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

type SignalCardProps = SignalRowProps & {
  variant?: "card" | "row";
};

export function SignalCard({
  ticker,
  returnPeriod = DEFAULT_RETURN_PERIOD,
  variant = "card",
  trending,
  stageFilter,
  showStageColumn,
}: SignalCardProps) {
  const tags = useMemo(() => collectTags(ticker), [ticker]);
  const visibleTags = tags.slice(0, MAX_TAGS);
  const overflow = tags.length - visibleTags.length;
  const overflowList = overflow > 0 ? tags.slice(MAX_TAGS).join(", ") : "";

  if (variant === "row") {
    return (
      <SignalRow
        ticker={ticker}
        returnPeriod={returnPeriod}
        trending={trending}
        stageFilter={stageFilter}
        showStageColumn={showStageColumn}
      />
    );
  }

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

        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <Tooltip side="bottom" align="start" content={AI_SCORE_TIP}>
            <span className="flex items-baseline gap-1">
              <span className="type-overline text-blue-500/70 dark:text-blue-400/60">AI</span>
              <span className="num text-xl font-black leading-none text-blue-500 dark:text-blue-400">
                {ticker.aiScore}
              </span>
              <span className="text-[9px] text-muted">/100</span>
            </span>
          </Tooltip>
          <Tooltip side="bottom" align="end" content={OPP_SCORE_TIP}>
            <span className="flex items-baseline gap-1 text-right">
              <span className="type-overline text-amber-500/70 dark:text-amber-400/60">Opp</span>
              <span className="num text-sm font-bold leading-none text-amber-500 dark:text-amber-400">
                #{ticker.opportunityScore}
              </span>
            </span>
          </Tooltip>
        </div>

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
                      : "text-rose-600 dark:text-red-400"
                  }`}
                >
                  {ticker.netPremium > 0 ? "+" : ""}${(Math.abs(ticker.netPremium) / 1e6).toFixed(1)}M
                </span>
              </Tooltip>
            )}
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            <VoteButton symbol={ticker.symbol} size="sm" fetchEnabled={false} />
            <CardChevron />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
