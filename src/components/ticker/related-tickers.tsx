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
  /** Stitch-style sidebar list (ticker detail) */
  variant?: "default" | "sidebar";
}

export function RelatedTickers({ tickers, isLoading, variant = "default" }: RelatedTickersProps) {
  const shell =
    variant === "sidebar"
      ? "rounded-xl border border-slate-200 dark:border-[#1e262f] dark:bg-[#12181f]"
      : "rounded-2xl border-gray-200/90 dark:border-zinc-800/90";

  if (isLoading) {
    return (
      <Card className={shell}>
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </Card>
    );
  }

  if (tickers.length === 0) return null;

  if (variant === "sidebar") {
    return (
      <div className={`p-6 ${shell}`}>
        <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">Related tickers</h3>
        <div className="flex flex-col gap-2">
          {tickers.map((t) => {
            const matchPct = Math.round(t.correlationScore * 100);
            return (
              <Link key={t.symbol} href={`/ticker/${t.symbol}`} className="group block">
                <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:border-blue-500/30 hover:bg-blue-600/5 dark:border-[#1e262f] dark:bg-[#1e262f]/30 dark:hover:bg-blue-500/10">
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="font-bold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {t.symbol}
                    </span>
                    {t.name ? (
                      <span className="truncate text-[10px] text-slate-500 dark:text-zinc-500">{t.name}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-blue-600 dark:text-blue-400">{matchPct}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-zinc-800/90">
      <div className="px-4 py-4 sm:px-8 sm:py-5">
        <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-100">Related tickers</h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
          Tickers that frequently appear in the same scans
        </p>
      </div>
      <div className="border-t border-gray-100 px-4 pb-5 dark:border-zinc-800 sm:px-8 sm:pb-6">
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tickers.map((t) => (
            <Link key={t.symbol} href={`/ticker/${t.symbol}`}>
              <div className="rounded-xl border border-gray-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30 dark:border-zinc-800 dark:hover:border-blue-500/30 dark:hover:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">{t.symbol}</span>
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
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-zinc-500">{t.name}</p>
                )}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-zinc-500">
                    {t.coOccurrenceCount} shared scan{t.coOccurrenceCount !== 1 ? "s" : ""}
                  </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {Math.round(t.correlationScore * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500 dark:bg-blue-500"
                    style={{ width: `${Math.min(100, t.correlationScore * 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500">
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
