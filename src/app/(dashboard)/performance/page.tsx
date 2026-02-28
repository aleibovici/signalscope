"use client";

import { useState } from "react";
import { useAggregatePerformance } from "@/hooks/use-performance";
import type { PerformanceStats, PerformerEntry } from "@/hooks/use-performance";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const INTERVALS = [
  { label: "1d", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function StatsTable({
  title,
  data,
}: {
  title: string;
  data: Record<string, PerformanceStats>;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium text-right">Count</th>
                <th className="pb-2 pr-4 font-medium text-right">Win Rate</th>
                <th className="pb-2 font-medium text-right">Avg Return</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, stats]) => (
                <tr key={key} className="border-b border-gray-50">
                  <td className="py-1.5 pr-4 font-medium text-gray-700">
                    {key.replace(/_/g, " ")}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600">
                    {stats.count}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600">
                    {(stats.winRate * 100).toFixed(0)}%
                  </td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      stats.avgReturn > 0
                        ? "text-green-600"
                        : stats.avgReturn < 0
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    {formatPct(stats.avgReturn)}
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
        <h3 className="font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Symbol</th>
                <th className="pb-2 pr-4 font-medium text-right">Return</th>
                <th className="pb-2 pr-4 font-medium text-right">Score</th>
                <th className="pb-2 pr-4 font-medium">Stage</th>
                <th className="pb-2 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {performers.map((p, i) => (
                <tr key={`${p.symbol}-${i}`} className="border-b border-gray-50">
                  <td className="py-1.5 pr-4 font-medium text-blue-600">
                    <a href={`/ticker/${p.symbol}`}>{p.symbol}</a>
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right font-medium ${
                      p.return > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatPct(p.return)}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-600">
                    {p.aiScore}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-600">{p.stage}</td>
                  <td className="py-1.5 text-right text-gray-600">
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

export default function PerformancePage() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useAggregatePerformance(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold md:text-2xl">Signal Performance</h1>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.days}
              onClick={() => setDays(iv.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === iv.days
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      )}

      {error && (
        <p className="text-center text-gray-500">
          Failed to load performance data.
        </p>
      )}

      {data && (
        <>
          {/* Headline stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Tracked Tickers</p>
                <p className="text-3xl font-bold text-gray-900">
                  {data.overall.count}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Win Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {data.overall.count > 0
                    ? `${(data.overall.winRate * 100).toFixed(0)}%`
                    : "--"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-gray-500">Avg Return</p>
                <p
                  className={`text-3xl font-bold ${
                    data.overall.avgReturn > 0
                      ? "text-green-600"
                      : data.overall.avgReturn < 0
                        ? "text-red-600"
                        : "text-gray-900"
                  }`}
                >
                  {data.overall.count > 0
                    ? formatPct(data.overall.avgReturn)
                    : "--"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown tables */}
          <div className="grid gap-4 lg:grid-cols-3">
            <StatsTable title="By Stage" data={data.byStage} />
            <StatsTable title="By Signal Type" data={data.byType} />
            <StatsTable title="By Score Range" data={data.byScoreRange} />
          </div>

          {/* Best/Worst performers */}
          <div className="grid gap-4 lg:grid-cols-2">
            <PerformersTable
              title="Best Performers"
              performers={data.bestPerformers}
            />
            <PerformersTable
              title="Worst Performers"
              performers={data.worstPerformers}
            />
          </div>
        </>
      )}
    </div>
  );
}
