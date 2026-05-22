"use client";

import { recommendationLevels, signalSources, signalStages } from "@/lib/methodology-data";
import { stageLabel } from "@/lib/stage-labels";
import type { TrendingTicker } from "@/hooks/use-trending";
import type { ValidatedTickerData } from "@/hooks/use-scans";

export const MAX_TAGS = 2;

export type SignalCardTrendingMeta = Pick<TrendingTicker, "trend" | "appearanceCount">;

export const SOURCE_METH_NAME: Record<string, string> = {
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

export const STAGE_TOOLTIP_BY_DISPLAY = Object.fromEntries(
  signalStages.map((row) => [stageLabel(row.stage), row.desc]),
) as Record<string, string>;

export const REC_TOOLTIP_BY_LEVEL = Object.fromEntries(
  recommendationLevels.map((row) => [row.level, row.desc]),
) as Record<string, string>;

export const SOURCE_TOOLTIP_BY_ENUM = Object.fromEntries(
  Object.entries(SOURCE_METH_NAME).map(([enumKey, name]) => {
    const row = signalSources.find((s) => s.name === name);
    return [enumKey, row?.description ?? enumKey.replace(/_/g, " ")];
  }),
) as Record<string, string>;

export const TAG_TOOLTIPS: Record<string, string> = {
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
  "Bearish Flow": "Net put premium exceeds puts — options market leaning bearish.",
};

export const AI_SCORE_TIP =
  "AI confidence (0–100) — evidence strength from sources, sentiment, and corroboration. Not expected upside.";
export const OPP_SCORE_TIP =
  "Opportunity rank — early-mover/setup score. Drives list order within a stage.";
export const NET_PREMIUM_TIP =
  "Net options premium flow: call dollar volume minus put dollar volume. Positive = bullish institutional positioning.";

export const recBorderColors: Record<string, string> = {
  "Strong Buy": "border-emerald-500/70 text-emerald-600 dark:border-emerald-400/50 dark:text-emerald-400",
  Buy: "border-green-500/70 text-green-600 dark:border-green-400/50 dark:text-green-400",
  Watch: "border-amber-500/70 text-amber-600 dark:border-amber-400/50 dark:text-amber-400",
  Avoid: "border-red-500/60 text-red-600 dark:border-red-400/40 dark:text-red-400",
};

export const stagePillStyles: Record<string, string> = {
  Emerging: "bg-emerald-500/10 text-stage-early border-emerald-500/30 dark:bg-emerald-400/10",
  Building: "bg-amber-500/10 text-stage-forming border-amber-500/30 dark:bg-amber-400/10",
  Consensus: "bg-blue-500/10 text-stage-confirmed border-blue-500/30 dark:bg-blue-400/10",
  Filtered: "bg-red-500/10 text-stage-filtered border-red-500/30 dark:bg-red-400/10",
  Unscored: "bg-zinc-500/10 text-stage-unscored border-zinc-500/30 dark:bg-zinc-400/10",
};

export const stageBarColors: Record<string, string> = {
  Emerging: "bg-emerald-500",
  Building: "bg-amber-500",
  Consensus: "bg-blue-500",
  Filtered: "bg-red-500",
  Unscored: "bg-zinc-400",
};

export const tagStyleMap: Record<string, string> = {
  "P&D Risk": "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
  New: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400",
  "Bullish Flow": "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  "Bearish Flow": "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400",
  "Short Squeeze": "bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  Momentum: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  "Near 52W Low": "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  "High Velocity": "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-400",
  Recovery: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400",
  "Multi-Reddit": "bg-purple-500/10 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  "High SI": "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
};

export const trendConfig: Record<
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

export function tagTooltip(tag: string, ticker: ValidatedTickerData): string {
  if (tag.startsWith("Seen ")) {
    return `Seen in ${ticker.priorAppearances} prior scans — repeats without a new catalyst often mean less remaining upside.`;
  }
  return TAG_TOOLTIPS[tag] ?? tag;
}

export function netPremiumTooltip(ticker: ValidatedTickerData): string {
  const callPct =
    ticker.callPremiumRatio != null
      ? ` ${Math.round(ticker.callPremiumRatio * 100)}% of premium is calls.`
      : "";
  return `${NET_PREMIUM_TIP}${callPct}`;
}

export function appearanceHeat(count: number): string {
  if (count >= 6) return "bg-orange-500/15 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400";
  if (count >= 4) return "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400";
  return "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400";
}

export function collectTags(ticker: ValidatedTickerData): string[] {
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

export function SignalDot({ stage }: { stage: string }) {
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

export function TrendingCardHeader({ trending }: { trending: SignalCardTrendingMeta }) {
  const cfg = trendConfig[trending.trend];
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 pb-1 pt-1.5">
      <span className={`text-[11px] font-semibold ${cfg.classes}`} title={cfg.tip}>
        <span className="mr-0.5">{cfg.icon}</span>
        {cfg.label}
      </span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${appearanceHeat(trending.appearanceCount)}`}
        title={`Appeared in ${trending.appearanceCount} completed scans in the last 30 days.`}
      >
        {trending.appearanceCount}×
      </span>
    </div>
  );
}

export function TrendingRowBadge({ trending }: { trending: SignalCardTrendingMeta }) {
  const cfg = trendConfig[trending.trend];
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className={`text-[10px] font-semibold ${cfg.classes}`} title={cfg.tip}>
        {cfg.icon}
      </span>
      <span
        className={`rounded px-1 py-px text-[9px] font-medium ${appearanceHeat(trending.appearanceCount)}`}
        title={`${trending.appearanceCount} appearances in 30 days`}
      >
        {trending.appearanceCount}×
      </span>
    </span>
  );
}
