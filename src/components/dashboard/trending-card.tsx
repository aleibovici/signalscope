"use client";

import { Badge } from "@/components/ui/badge";
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
  returnPeriod = "7d",
}: {
  ticker: TrendingTicker;
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

      <SignalCard
        ticker={ticker}
        returnPeriod={returnPeriod}
      />
    </div>
  );
}
