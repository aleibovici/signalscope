"use client";

import { useState } from "react";
import { useAggregatePerformance } from "@/hooks/use-performance";
import type {
  PerformanceStats,
  PerformerEntry,
  CohortEntry,
} from "@/hooks/use-performance";
import { EmergingReturnsChart } from "@/components/emerging-returns-chart";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { STAGE_LABELS } from "@/lib/stage-labels";


/* ---------- Info Tooltip ---------- */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1 inline-block cursor-help align-middle">
      <svg className="inline h-3.5 w-3.5 text-gray-300 dark:text-zinc-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
      </svg>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-52 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-snug font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
        {text}
      </span>
    </span>
  );
}

const INTERVALS = [
  { label: "1d", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatPctShort(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(0)}%`;
}


/* ---------- Summary Cards with Delta ---------- */
function SummaryCards({
  summary,
}: {
  summary: { totalTracked: number; current: PerformanceStats; prior: PerformanceStats };
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
    <div className="grid gap-4 sm:grid-cols-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Emerging Tracked<InfoTip text="Unique tickers detected at the Emerging stage across all scans." /></p>
          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
            {summary.totalTracked}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">all time, deduplicated</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Win Rate (last 30d)<InfoTip text="Percentage of emerging signals detected in the last 30 days that had a positive return over the selected period." /></p>
          <p className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
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
          <p className="text-sm text-gray-500 dark:text-zinc-400">Avg Return (last 30d)<InfoTip text="Mean return of all emerging signals detected in the last 30 days, measured at the selected period (1d/3d/7d/30d) after detection." /></p>
          <p
            className={`text-3xl font-bold ${
              hasData && current.avgReturn > 0
                ? "text-green-600 dark:text-green-400"
                : hasData && current.avgReturn < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-900 dark:text-zinc-100"
            }`}
          >
            {hasData ? formatPct(current.avgReturn) : "--"}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{hasData ? `${current.count} signals` : "no data"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-zinc-400">Last 30d vs Prior 30d<InfoTip text="Compares win rate and average return of emerging signals from the last 30 days against the prior 30-day window." /></p>
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
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Weekly Signal Cohorts</h3>
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Signals grouped by detection week — how did each week&apos;s picks perform?
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 pr-4 font-medium">Week</th>
                <th className="pb-2 pr-3 font-medium text-right">Signals</th>
                <th className="pb-2 pr-3 font-medium text-right">{horizon} WR</th>
                <th className="pb-2 pr-3 font-medium text-right">{horizon} Avg</th>
                <th className="pb-2 pr-3 font-medium text-right">{horizon} Median</th>
                <th className="pb-2 font-medium text-right">Best Pick</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const s = c.stats[horizon];
                return (
                  <tr key={c.weekStart} className="border-b border-gray-50 dark:border-zinc-800/80">
                    <td className="py-2 pr-4 font-medium whitespace-nowrap text-gray-700 dark:text-zinc-200">
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
                      className={`py-2 pr-3 text-right font-medium ${
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
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium text-right">Count</th>
                <th className="pb-2 pr-4 font-medium text-right">Win Rate</th>
                <th className="pb-2 pr-4 font-medium text-right">Avg Return</th>
                <th className="pb-2 font-medium text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, stats]) => (
                <tr key={key} className="border-b border-gray-50 dark:border-zinc-800/80">
                  <td className="py-1.5 pr-4 font-medium text-gray-700 dark:text-zinc-200">
                    {STAGE_LABELS[key] ?? key.replace(/_/g, " ")}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-zinc-400">
                    {stats.count}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-zinc-400">
                    {(stats.winRate * 100).toFixed(0)}%
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right font-medium ${
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
                    className={`py-1.5 text-right font-medium ${
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

/* ---------- Performers Table ---------- */
function PerformersTable({
  title,
  performers,
}: {
  title: string;
  performers: PerformerEntry[];
}) {
  if (performers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 pr-4 font-medium">Symbol</th>
                <th className="pb-2 pr-4 font-medium text-right">Return</th>
                <th className="pb-2 pr-4 font-medium text-right">Score</th>
                <th className="pb-2 pr-4 font-medium">Detected</th>
                <th className="pb-2 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {performers.map((p, i) => (
                <tr key={`${p.symbol}-${i}`} className="border-b border-gray-50 dark:border-zinc-800/80">
                  <td className="py-1.5 pr-4 font-medium text-blue-600 dark:text-blue-400">
                    <a href={`/ticker/${p.symbol}`}>{p.symbol}</a>
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right font-medium ${
                      p.return > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPct(p.return)}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-zinc-400">
                    {p.aiScore}
                  </td>
                  <td className="py-1.5 pr-4 whitespace-nowrap text-gray-500 dark:text-zinc-500">
                    {new Date(p.detectedAt + "T00:00:00Z").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="py-1.5 text-right text-gray-600 dark:text-zinc-400">
                    ${p.detectionPrice.toFixed(2)} → ${p.currentPrice.toFixed(2)}
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
  const { data, isLoading, error } = useAggregatePerformance(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl dark:text-zinc-100">Signal Performance</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            How signals perform after detection — broken down by week, stage, and type
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-900">
          {INTERVALS.map((iv) => (
            <button
              key={iv.days}
              onClick={() => setDays(iv.days)}
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
          <SummaryCards summary={data.summary} />

          {/* Weekly cohort table */}
          <CohortTable cohorts={data.cohorts} days={days} />

          {/* Daily return visualization */}
          <EmergingReturnsChart data={data.dailyReturns} horizon={days} />

          {/* By signal type breakdown */}
          <StatsTable title="By Signal Type" data={data.byType} />

          {/* Best performers */}
          <PerformersTable
            title="Best Performers"
            performers={data.bestPerformers}
          />
        </>
      )}
    </div>
  );
}
