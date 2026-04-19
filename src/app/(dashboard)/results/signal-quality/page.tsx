"use client";

import { useState } from "react";
import { useAggregatePerformance } from "@/hooks/use-performance";
import type {
  PerformanceStats,
  CohortEntry,
} from "@/hooks/use-performance";
import { EmergingReturnsChart } from "@/components/emerging-returns-chart";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/ui/page-header";
import { InfoTip } from "@/components/ui/tooltip";
import { STAGE_LABELS } from "@/lib/stage-labels";

const INTERVALS = [
  { label: "1d", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

function formatTimeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatPctShort(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(0)}%`;
}


/* ---------- Summary Cards with Delta ---------- */
function SummaryCards({
  summary,
  days,
}: {
  summary: { totalTracked: number; current: PerformanceStats; prior: PerformanceStats };
  days: number;
}) {
  const { current } = summary;
  const hasData = current.count > 0;
  const wrDelta =
    current.count > 0 && summary.prior.count > 0
      ? current.winRate - summary.prior.winRate
      : null;
  const arDelta =
    current.count > 0 && summary.prior.count > 0
      ? current.avgReturn - summary.prior.avgReturn
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">High-Score Picks<InfoTip text="Unique tickers that scored 70+ on AI signal confidence with return data for the selected period." /></p>
          <p className="num text-3xl font-bold text-gray-900 dark:text-zinc-100">
            {summary.totalTracked}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">with {days}d return data</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Win Rate ({days}d)<InfoTip text="Percentage of high-score picks (AI ≥70) detected in the last 30 days that had a positive return over the selected period." /></p>
          <p className="num text-3xl font-bold text-gray-900 dark:text-zinc-100">
            {hasData
              ? `${(current.winRate * 100).toFixed(0)}%`
              : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {hasData ? `${current.count} signals` : "no data"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Median Return ({days}d)<InfoTip text="Median return of all high-score picks (AI ≥70) detected in the last 30 days, measured at the selected period after detection. More representative than the mean for skewed distributions." /></p>
          <p
            className={`num text-3xl font-bold ${
              hasData && current.medianReturn > 0
                ? "text-green-600 dark:text-green-400"
                : hasData && current.medianReturn < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-900 dark:text-zinc-100"
            }`}
          >
            {hasData ? formatPct(current.medianReturn) : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{hasData ? `Avg: ${formatPct(current.avgReturn)}` : "no data"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Last 30d vs Prior 30d<InfoTip text="Compares win rate and average return of high-score picks (AI ≥70) from the last 30 days against the prior 30-day window." /></p>
          <div className="mt-1 space-y-1">
            {summary.prior.count === 0 ? (
              <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
                Building comparison history…
              </p>
            ) : (
              <>
                {wrDelta !== null ? (
                  <p className="text-sm">
                    <span className="text-gray-500 dark:text-zinc-400">Win rate </span>
                    <span
                      className={`font-semibold ${
                        wrDelta > 0
                          ? "text-green-600 dark:text-green-400"
                          : wrDelta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-zinc-300"
                      }`}
                    >
                      {wrDelta > 0 ? "+" : ""}
                      {(wrDelta * 100).toFixed(0)}pp
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-zinc-500">--</p>
                )}
                {arDelta !== null ? (
                  <p className="text-sm">
                    <span className="text-gray-500 dark:text-zinc-400">Avg return </span>
                    <span
                      className={`font-semibold ${
                        arDelta > 0
                          ? "text-green-600 dark:text-green-400"
                          : arDelta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-zinc-300"
                      }`}
                    >
                      {formatPct(arDelta)}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-zinc-500">--</p>
                )}
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {summary.current.count} recent / {summary.prior.count} prior
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Cohort Table ---------- */
function CohortTable({ cohorts, days }: { cohorts: CohortEntry[]; days: number }) {
  if (cohorts.length === 0) return null;

  const horizon = `${days}d`;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Weekly High-Score Cohorts</h3>
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          High-confidence picks (AI ≥70) grouped by detection week — how did each week&apos;s picks perform?
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 pr-3 font-medium">Week</th>
                <th className="pb-2 pr-3 font-medium text-right">Signals</th>
                <th className="pb-2 pr-3 font-medium text-right">{horizon} WR</th>
                <th className="pb-2 pr-3 font-medium text-right">{horizon} Avg</th>
                <th className="hidden sm:table-cell pb-2 pr-3 font-medium text-right">{horizon} Median</th>
                <th className="pb-2 font-medium text-right">Best Pick</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const s = c.stats[horizon];
                return (
                  <tr key={c.weekStart} className="border-b border-gray-50 dark:border-zinc-800/80">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap text-gray-700 dark:text-zinc-200">
                      {c.weekLabel}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-zinc-400">
                      {c.count}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-zinc-400">
                      {s ? `${(s.winRate * 100).toFixed(0)}%` : "--"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-medium ${
                        s && s.avgReturn > 0
                          ? "text-green-600 dark:text-green-400"
                          : s && s.avgReturn < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-zinc-500"
                      }`}
                    >
                      {s ? formatPct(s.avgReturn) : "--"}
                    </td>
                    <td
                      className={`hidden sm:table-cell py-2 pr-3 text-right font-medium ${
                        s && s.medianReturn > 0
                          ? "text-green-600 dark:text-green-400"
                          : s && s.medianReturn < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-zinc-500"
                      }`}
                    >
                      {s ? formatPct(s.medianReturn) : "--"}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {c.bestPick ? (
                        <a
                          href={`/ticker/${c.bestPick.symbol}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {c.bestPick.symbol}{" "}
                          <span
                            className={
                              c.bestPick.returnPct > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatPctShort(c.bestPick.returnPct)}
                          </span>
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-500">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


/* ---------- Breakdown Tables ---------- */
function StatsTable({
  title,
  description,
  data,
}: {
  title: string;
  description?: string;
  data: Record<string, PerformanceStats>;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
        {description && (
          <p className="text-xs text-gray-400 dark:text-zinc-500">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 pr-3 font-medium">Category</th>
                <th className="pb-2 pr-3 font-medium text-right">Count</th>
                <th className="pb-2 pr-3 font-medium text-right">Win Rate</th>
                <th className="pb-2 pr-3 font-medium text-right">Avg Return</th>
                <th className="hidden sm:table-cell pb-2 font-medium text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, stats]) => (
                <tr key={key} className="border-b border-gray-50 dark:border-zinc-800/80">
                  <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-zinc-200">
                    {STAGE_LABELS[key] ?? key.replace(/_/g, " ")}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-600 dark:text-zinc-400">
                    {stats.count}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-600 dark:text-zinc-400">
                    {(stats.winRate * 100).toFixed(0)}%
                  </td>
                  <td
                    className={`py-1.5 pr-3 text-right font-medium ${
                      stats.avgReturn > 0
                        ? "text-green-600 dark:text-green-400"
                        : stats.avgReturn < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-zinc-400"
                    }`}
                  >
                    {formatPct(stats.avgReturn)}
                  </td>
                  <td
                    className={`hidden sm:table-cell py-1.5 text-right font-medium ${
                      stats.medianReturn > 0
                        ? "text-green-600 dark:text-green-400"
                        : stats.medianReturn < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-zinc-400"
                    }`}
                  >
                    {formatPct(stats.medianReturn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


/* ---------- Main Page ---------- */
export default function PerformancePage() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error, dataUpdatedAt } = useAggregatePerformance(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Signal Performance"
          subtitle="How high-confidence signals (AI score ≥70) perform after detection — broken down by week and type"
          meta={dataUpdatedAt > 0 ? `Updated ${formatTimeAgo(new Date(dataUpdatedAt))}` : undefined}
        />
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-900">
          {INTERVALS.map((iv) => (
            <button
              key={iv.days}
              onClick={() => setDays(iv.days)}
              aria-pressed={days === iv.days}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === iv.days
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {error && (
        <p className="text-center text-gray-500 dark:text-zinc-400">
          Failed to load performance data.
        </p>
      )}

      {data && (
        <>
          {/* Summary cards with period comparison */}
          <SummaryCards summary={data.summary} days={days} />

          {/* Weekly cohort table */}
          <CohortTable cohorts={data.cohorts} days={days} />

          {/* Daily return visualization */}
          <EmergingReturnsChart data={data.dailyReturns} horizon={days} />

          {/* By signal type breakdown */}
          <StatsTable title="By Signal Type" data={data.byType} />
        </>
      )}
    </div>
  );
}
