"use client";

import { useStats } from "@/hooks/use-stats";

export function StatsWidget({ revision }: { revision: string }) {
  const { data, isLoading, isError } = useStats();

  if (isError) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Platform Stats
      </p>
      {isLoading || !data ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-10 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <dt className="text-xs text-gray-500">Scans</dt>
          <dd className="text-right text-xs font-medium text-gray-700">{data.scans}</dd>

          <dt className="text-xs text-gray-500">Signals</dt>
          <dd className="text-right text-xs font-medium text-gray-700">{data.signals.toLocaleString()}</dd>

          <dt className="text-xs text-gray-500">Tickers</dt>
          <dd className="text-right text-xs font-medium text-gray-700">{data.tickers.toLocaleString()}</dd>

          <dt className="text-xs text-gray-500">Users</dt>
          <dd className="text-right text-xs font-medium text-gray-700">{data.users}</dd>

          <dt className="text-xs text-gray-500">Version</dt>
          <dd className="text-right text-xs font-medium text-gray-700">{revision}</dd>
        </dl>
      )}
    </div>
  );
}
