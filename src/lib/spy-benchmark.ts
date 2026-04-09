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

/* ── Per-trade matched SPY return ─────────────────────────────────── */

const spyBarsCache = new TTLCache<SpyHistoryBar[]>(SPY_RETURN_CACHE_TTL_MS, 4);

/** Fetch raw SPY daily bars for a window (cached). */
export async function fetchSpyDailyBars(
  windowStart: Date,
  windowEnd: Date,
): Promise<SpyHistoryBar[]> {
  const key = `bars:${cacheKeyForWindow(windowStart, windowEnd)}`;
  const hit = spyBarsCache.get(key);
  if (hit !== undefined) return hit;

  try {
    const rows = await withYahooTimeout(
      yahooFinance.historical(SPY_BENCHMARK_SYMBOL, {
        period1: windowStart,
        period2: windowEnd,
        interval: "1d",
      }),
    );
    if (!Array.isArray(rows)) return [];
    const bars = (rows as SpyHistoryBar[]).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    spyBarsCache.set(key, bars);
    return bars;
  } catch {
    return [];
  }
}

const HOLD_DAYS_MAP: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };

/**
 * Compute SPY return for the same period as a trade.
 * Finds the bar on-or-after detectedAt (entry) and on-or-after detectedAt+holdDays (exit).
 */
export function spyReturnForTrade(
  bars: SpyHistoryBar[],
  detectedAt: Date,
  holdDays: string | null,
): number | null {
  if (!holdDays || bars.length < 2) return null;
  const hold = HOLD_DAYS_MAP[holdDays];
  if (!hold) return null;

  const entryMs = detectedAt.getTime();
  const exitMs = entryMs + hold * 86400000;

  const entryBar = findBarOnOrAfter(bars, entryMs);
  const exitBar = findBarOnOrAfter(bars, exitMs);
  if (!entryBar || !exitBar || entryBar === exitBar) return null;

  const entryPx = entryBar.adjClose ?? entryBar.close;
  const exitPx = exitBar.adjClose ?? exitBar.close;
  if (typeof entryPx !== "number" || typeof exitPx !== "number" || entryPx <= 0)
    return null;
  return (exitPx - entryPx) / entryPx;
}

function findBarOnOrAfter(bars: SpyHistoryBar[], ms: number): SpyHistoryBar | null {
  for (const b of bars) {
    if (b.date.getTime() >= ms - 86400000) return b; // allow up to 1 day before (weekends)
  }
  return bars.length > 0 ? bars[bars.length - 1] : null;
}
