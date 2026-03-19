"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { SignalCard } from "@/components/dashboard/signal-card";
import type { TrendingTicker } from "@/hooks/use-trending";

const trendVariants: Record<string, "success" | "danger" | "default"> = {
  rising: "success",
  falling: "danger",
  stable: "default",
};

const trendLabels: Record<string, string> = {
  rising: "Rising",
  falling: "Falling",
  stable: "Stable",
};

export function TrendingCard({
  ticker,
  isBookmarked = false,
  onToggle,
  returnPeriod = "7d",
}: {
  ticker: TrendingTicker;
  isBookmarked?: boolean;
  onToggle?: (symbol: string, currentlyBookmarked: boolean) => void;
  returnPeriod?: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={trendVariants[ticker.trend]}>
            {trendLabels[ticker.trend]}
          </Badge>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            {ticker.appearanceCount} appearances
          </span>
        </div>
      </div>

      {ticker.scoreTrajectory.length > 1 && (
        <div className="mb-2 rounded-lg border border-gray-100 bg-gray-50/60 px-1 py-0.5 dark:border-zinc-800/80 dark:bg-zinc-900/35">
          <Sparkline points={ticker.scoreTrajectory} height={48} />
        </div>
      )}

      <SignalCard
        ticker={ticker}
        isBookmarked={isBookmarked}
        onToggle={onToggle}
        returnPeriod={returnPeriod}
      />
    </div>
  );
}
