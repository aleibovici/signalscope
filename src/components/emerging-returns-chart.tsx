"use client";

export interface DailyReturnEntry {
  date: string;
  avgReturn: number;
  tradeCount: number;
  winCount: number;
}

function fmt(v: number) {
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export function EmergingReturnsChart({ data, horizon = 7 }: { data: DailyReturnEntry[]; horizon?: number }) {
  if (data.length === 0) return null;

  const byDate = new Map<string, DailyReturnEntry>();
  for (const d of data) byDate.set(d.date, d);
  const recent = [...byDate.values()].slice(-14).reverse();

  const maxAbs = Math.max(...recent.map((p) => Math.abs(p.avgReturn)), 0.001);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Emerging — Avg {horizon}d Return by Detection Date</h3>
        <p className="text-xs text-gray-400 dark:text-zinc-500">Average {horizon}-day return for emerging signals, grouped by the date they were detected</p>
      </div>
      <div className="space-y-1">
        {recent.map((p) => {
          const width = Math.abs(p.avgReturn) / maxAbs;
          const isPositive = p.avgReturn >= 0;
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
                {fmt(p.avgReturn)}
              </span>
              <span className="w-8 shrink-0 text-right text-gray-400 dark:text-zinc-500">n={p.tradeCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
