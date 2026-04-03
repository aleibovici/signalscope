import { TTLCache } from "@/lib/cache";
import { yahooFinance, withYahooTimeout } from "@/lib/yahoo-finance";

export const SPY_BENCHMARK_SYMBOL = "SPY";

/** In-memory cache: SPY total return for a rolling window changes slowly (daily bars). */
const SPY_RETURN_CACHE_TTL_MS = 45 * 60 * 1000;

const spyTotalReturnCache = new TTLCache<number>(SPY_RETURN_CACHE_TTL_MS, 8);

function cacheKeyForWindow(windowStart: Date, windowEnd: Date): string {
  const a = windowStart.toISOString().slice(0, 10);
  const b = windowEnd.toISOString().slice(0, 10);
  return `${SPY_BENCHMARK_SYMBOL}:${a}:${b}`;
}

export type SpyHistoryBar = { date: Date; close: number; adjClose?: number };

export function totalReturnDecimalFromBars(rows: SpyHistoryBar[]): number | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startPx = first.adjClose ?? first.close;
  const endPx = last.adjClose ?? last.close;
  if (typeof startPx !== "number" || typeof endPx !== "number" || startPx <= 0) return null;
  return (endPx - startPx) / startPx;
}

export async function fetchSpyTotalReturnDecimal(
  windowStart: Date,
  windowEnd: Date,
): Promise<number | null> {
  const key = cacheKeyForWindow(windowStart, windowEnd);
  const hit = spyTotalReturnCache.get(key);
  if (hit !== undefined) return hit;

  try {
    const rows = await withYahooTimeout(
      yahooFinance.historical(SPY_BENCHMARK_SYMBOL, {
        period1: windowStart,
        period2: windowEnd,
        interval: "1d",
      }),
    );
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const pct = totalReturnDecimalFromBars(rows as SpyHistoryBar[]);
    if (pct !== null) spyTotalReturnCache.set(key, pct);
    return pct;
  } catch {
    return null;
  }
}
