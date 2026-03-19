"use client";

export interface ReturnEntry {
  date: string;
  cumReturn: number;
  tradeCount: number;
  winCount: number;
}

function computeWindowAvg(entries: ReturnEntry[]): number | null {
  const byDate = new Map<string, ReturnEntry>();
  for (const d of entries) byDate.set(d.date, d);
  const recent = [...byDate.values()].slice(-7);
  const totalCount = recent.reduce((s, p) => s + p.tradeCount, 0);
  if (totalCount === 0) return null;
  return recent.reduce((s, p) => s + p.cumReturn * p.tradeCount, 0) / totalCount;
}

function fmt(v: number) {
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export function EmergingReturnsChart({ data, horizon = 7 }: { data: ReturnEntry[]; horizon?: number }) {
  if (data.length === 0) return null;

  const byDate = new Map<string, ReturnEntry>();
  for (const d of data) byDate.set(d.date, d);
  const recent = [...byDate.values()].slice(-7);

  const maxAbs = Math.max(...recent.map((p) => Math.abs(p.cumReturn)), 0.001);
  const windowAvg = computeWindowAvg(data);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Emerging — Avg {horizon}d Return by Detection Date</h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500">7-day rolling average {horizon}-day return for emerging signals, by detection date</p>
        </div>
        {windowAvg !== null && (
          <p className={`text-xl font-bold ${windowAvg > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {fmt(windowAvg)}
          </p>
        )}
      </div>
      <div className="space-y-1">
        {recent.map((p) => {
          const width = Math.abs(p.cumReturn) / maxAbs;
          const isPositive = p.cumReturn >= 0;
          return (
            <div key={p.date} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-gray-500 dark:text-zinc-400">
                {new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
              <div className="flex-1">
                <div className="relative h-4 rounded bg-gray-50 dark:bg-zinc-800/90">
                  <div
                    className={`absolute top-0 h-4 rounded ${isPositive ? "bg-green-200 dark:bg-green-700/70" : "bg-red-200 dark:bg-red-800/70"}`}
                    style={{
                      width: `${Math.max(width * 100, 2)}%`,
                      left: isPositive ? "0" : undefined,
                      right: isPositive ? undefined : "0",
                    }}
                  />
                </div>
              </div>
              <span className={`w-14 shrink-0 text-right font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {fmt(p.cumReturn)}
              </span>
              <span className="w-8 shrink-0 text-right text-gray-400 dark:text-zinc-500">n={p.tradeCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { computeWindowAvg };
