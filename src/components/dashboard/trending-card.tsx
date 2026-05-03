"use client";

import { Sparkline } from "@/components/ui/sparkline";
import { SignalCard } from "@/components/dashboard/signal-card";
import type { TrendingTicker } from "@/hooks/use-trending";

const trendConfig: Record<
  TrendingTicker["trend"],
  { icon: string; classes: string; label: string }
> = {
  rising:  { icon: "↑", classes: "text-emerald-600 dark:text-emerald-400", label: "Rising" },
  stable:  { icon: "→", classes: "text-gray-500 dark:text-zinc-400",       label: "Stable" },
  falling: { icon: "↓", classes: "text-rose-600 dark:text-rose-400",       label: "Falling" },
};

function appearanceHeat(count: number): string {
  if (count >= 6) return "bg-orange-500/15 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400";
  if (count >= 4) return "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400";
  return "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400";
}

export function TrendingCard({
  ticker,
  returnPeriod = "7d",
}: {
  ticker: TrendingTicker;
  returnPeriod?: string;
}) {
  const cfg = trendConfig[ticker.trend];

  const header = (
    <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-2 md:px-5">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold ${cfg.classes}`}>
          <span className="mr-0.5">{cfg.icon}</span>{cfg.label}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium pointer-events-auto ${appearanceHeat(ticker.appearanceCount)}`}>
          {ticker.appearanceCount}×
        </span>
      </div>
      {ticker.scoreTrajectory && ticker.scoreTrajectory.length > 1 && (
        <div className="pointer-events-auto">
          <Sparkline points={ticker.scoreTrajectory} height={24} />
        </div>
      )}
    </div>
  );

  return (
    <SignalCard
      ticker={ticker}
      returnPeriod={returnPeriod}
      header={header}
    />
  );
}
