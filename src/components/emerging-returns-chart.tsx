"use client";

export interface DailyReturnEntry {
  date: string;
  symbol: string;
  avgReturn: number;
  tradeCount: number;
  winCount: number;
}

function fmt(v: number) {
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

export function EmergingReturnsChart({ data, horizon = 7 }: { data: DailyReturnEntry[]; horizon?: number }) {
  if (data.length === 0) return null;

  const maxAbs = Math.max(...data.map((p) => Math.abs(p.avgReturn)), 0.001);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">High-Score Signals — {horizon}d Return per Pick</h3>
        <p className="text-xs text-gray-400 dark:text-zinc-500">{horizon}-day return for each AI score ≥70 signal, sorted by detection date</p>
      </div>
      <div className="space-y-1">
        {data.map((p, i) => {
          const width = Math.abs(p.avgReturn) / maxAbs;
          const isPositive = p.avgReturn >= 0;
          return (
            <div key={`${p.symbol}-${i}`} className="flex items-center gap-2 text-xs">
              <a
                href={`/ticker/${p.symbol}`}
                className="w-16 shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {p.symbol}
              </a>
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
              <span className="w-16 shrink-0 text-right text-gray-400 dark:text-zinc-500">
                {new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
