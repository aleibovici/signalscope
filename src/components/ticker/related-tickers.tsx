"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { stageLabel } from "@/lib/stage-labels";
import type { RelatedTicker } from "@/hooks/use-related";

interface RelatedTickersProps {
  tickers: RelatedTicker[];
  isLoading: boolean;
}

export function RelatedTickers({ tickers, isLoading }: RelatedTickersProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 text-blue-600" />
        </div>
      </Card>
    );
  }

  if (tickers.length === 0) return null;

  return (
    <Card>
      <div className="px-4 py-3 sm:px-6 sm:py-4">
        <h3 className="font-semibold">Related Tickers</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Tickers that frequently appear in the same scans
        </p>
      </div>
      <div className="border-t border-gray-100 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tickers.map((t) => (
            <Link key={t.symbol} href={`/ticker/${t.symbol}`}>
              <div className="rounded-lg border border-gray-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{t.symbol}</span>
                  <Badge
                    variant={
                      t.latestStage === "Emerging"
                        ? "success"
                        : t.latestStage === "Building"
                          ? "warning"
                          : t.latestStage === "Consensus"
                            ? "info"
                            : "info"
                    }
                  >
                    {stageLabel(t.latestStage)}
                  </Badge>
                </div>
                {t.name && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">{t.name}</p>
                )}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {t.coOccurrenceCount} shared scan{t.coOccurrenceCount !== 1 ? "s" : ""}
                  </span>
                  <span className="font-medium text-blue-600">
                    {Math.round(t.correlationScore * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, t.correlationScore * 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
                  <span>Score: {t.latestAiScore}</span>
                  {t.price != null && <span>${t.price.toFixed(2)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
