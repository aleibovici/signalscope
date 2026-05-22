import { prisma } from "@/lib/prisma";
import { TickerStage } from "@/generated/prisma/client";
import { TTLCache } from "@/lib/cache";

const WINDOW_DAYS = 90;
const MIN_SAMPLE = 10;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const STOP_R_R_RATIO = 1 / 1.5; // stop pct = target pct / 1.5

// Fallback when the rolling window has too few samples (e.g. fresh deploy, new stage).
// Numbers from a one-time analysis of production return7d (Buy/Strong Buy, 90d, P90).
// FILTERED/UNSCORED never have a tradeSetup, so they share EARLY's conservative fallback.
export const FALLBACK_TARGET_PCT: Record<TickerStage, number> = {
  EARLY: 0.06,
  FORMING: 0.15,
  CONFIRMED: 0.15,
  FILTERED: 0.06,
  UNSCORED: 0.06,
};

// Stage-based hold caps, in calendar days. From simulated TIME-exit analysis:
// EARLY trades decay past day 5; FORMING/CONFIRMED hold value through 7d.
// These match the ML model's max horizon (return7d).
export const HOLD_DAYS_BY_STAGE: Record<TickerStage, number> = {
  EARLY: 5,
  FORMING: 7,
  CONFIRMED: 7,
  FILTERED: 5,
  UNSCORED: 5,
};

export function holdDaysForStage(stage: TickerStage): number {
  return HOLD_DAYS_BY_STAGE[stage];
}

export interface TradeBracket {
  targetPct: number; // decimal, e.g. 0.06 = +6%
  stopPct: number; // decimal, negative
  source: "anchor" | "fallback";
  sampleSize: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const bracketCache = new TTLCache<Map<TickerStage, TradeBracket>>(CACHE_TTL_MS, 1);

async function computeBracketsByStage(): Promise<Map<TickerStage, TradeBracket>> {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000);

  // Pull return7d + stage for every Buy/Strong Buy pick in the window (no corp actions).
  // Single indexed query; ~24K rows × 90d window = small.
  const rows = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: windowStart },
      corporateActionDetected: false,
      return7d: { not: null },
      validatedTicker: { recommendation: { in: ["Buy", "Strong Buy"] } },
    },
    select: {
      return7d: true,
      validatedTicker: { select: { stage: true } },
    },
  });

  const byStage = new Map<TickerStage, number[]>();
  for (const r of rows) {
    const stage = r.validatedTicker?.stage;
    if (!stage || r.return7d === null) continue;
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage)!.push(r.return7d);
  }

  const result = new Map<TickerStage, TradeBracket>();
  for (const stage of [TickerStage.EARLY, TickerStage.FORMING, TickerStage.CONFIRMED]) {
    const values = (byStage.get(stage) ?? []).sort((a, b) => a - b);
    if (values.length >= MIN_SAMPLE) {
      const p90 = percentile(values, 0.9);
      // P90 should be positive for a strategy worth running; if it's not, fall back
      if (p90 > 0) {
        result.set(stage, {
          targetPct: p90,
          stopPct: -p90 * STOP_R_R_RATIO,
          source: "anchor",
          sampleSize: values.length,
        });
        continue;
      }
    }
    const fallback = FALLBACK_TARGET_PCT[stage];
    result.set(stage, {
      targetPct: fallback,
      stopPct: -fallback * STOP_R_R_RATIO,
      source: "fallback",
      sampleSize: values.length,
    });
  }
  return result;
}

/**
 * Return data-anchored target/stop percentages for a stage at the 7d horizon
 * (matches MAX_HOLD_DAYS and the ML model's longest horizon).
 *
 * Target = P90 of realized 7d returns for this stage over the last 90d
 *          (Buy/Strong Buy picks, no corporate actions).
 * Stop   = -target / 1.5 (maintains 1:1.5 R:R minimum).
 *
 * Cached for 1 hour. Falls back to hardcoded numbers when sample < 10
 * or when P90 is non-positive (no edge in this stage right now).
 */
export async function getTradeBracket(stage: TickerStage): Promise<TradeBracket> {
  const cached = bracketCache.get("all");
  if (cached?.get(stage)) return cached.get(stage)!;

  const fresh = await computeBracketsByStage();
  bracketCache.set("all", fresh);
  return (
    fresh.get(stage) ?? {
      targetPct: FALLBACK_TARGET_PCT[stage],
      stopPct: -FALLBACK_TARGET_PCT[stage] * STOP_R_R_RATIO,
      source: "fallback",
      sampleSize: 0,
    }
  );
}

/** Test-only: clear the cache so subsequent calls re-query. */
export function _clearBracketCache(): void {
  bracketCache.clear();
}
