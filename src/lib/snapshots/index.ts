import { prisma, createDevPrismaClient } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

interface IntervalConfig {
  field: "1d" | "3d" | "7d" | "30d";
  minHours: number;
  maxHours: number;
  snappedField: "snapped1dAt" | "snapped3dAt" | "snapped7dAt" | "snapped30dAt";
  priceField: "price1d" | "price3d" | "price7d" | "price30d";
  returnField: "return1d" | "return3d" | "return7d" | "return30d";
}

// maxHours is set wide enough to survive weekend/holiday gaps (3-day weekends etc.)
// 1d: 18h–120h (5 days), 3d: 60h–240h (10 days), 7d: 144h–480h (20 days), 30d: 672h–1344h (56 days)
const INTERVALS: IntervalConfig[] = [
  { field: "1d", minHours: 18, maxHours: 120, snappedField: "snapped1dAt", priceField: "price1d", returnField: "return1d" },
  { field: "3d", minHours: 60, maxHours: 240, snappedField: "snapped3dAt", priceField: "price3d", returnField: "return3d" },
  { field: "7d", minHours: 144, maxHours: 480, snappedField: "snapped7dAt", priceField: "price7d", returnField: "return7d" },
  { field: "30d", minHours: 672, maxHours: 1344, snappedField: "snapped30dAt", priceField: "price30d", returnField: "return30d" },
];

async function fetchPricesBatch(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50);
    try {
      const quotes = await yf.quote(batch);
      const list = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of list) {
        if (q.symbol && q.regularMarketPrice != null) {
          prices.set(q.symbol, q.regularMarketPrice);
        }
      }
    } catch (err) {
      console.warn(
        `[snapshots] Batch fetch failed for ${batch.length} symbols:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return prices;
}

export async function collectSnapshots(): Promise<{ filled: number; errors: number; skipped: number }> {
  const stats = { filled: 0, errors: 0, skipped: 0 };
  const now = new Date();
  const cutoff = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

  // 1. Get all eligible validated tickers from last 35 days
  const tickers = await prisma.validatedTicker.findMany({
    where: {
      createdAt: { gte: cutoff },
      price: { not: null },
    },
    include: { performance: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[snapshots] Found ${tickers.length} eligible tickers from last 35 days`);

  // 2. Determine which tickers need which intervals filled
  type PendingUpdate = {
    tickerId: string;
    validatedTickerId: string;
    symbol: string;
    detectionPrice: number;
    intervals: IntervalConfig[];
  };

  const pendingUpdates: PendingUpdate[] = [];
  const symbolsNeeded = new Set<string>();

  for (const ticker of tickers) {
    const ageMs = now.getTime() - new Date(ticker.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const perf = ticker.performance;

    const dueIntervals = INTERVALS.filter((iv) => {
      if (ageHours < iv.minHours || ageHours > iv.maxHours) return false;
      if (perf && perf[iv.snappedField] != null) return false;
      return true;
    });

    if (dueIntervals.length === 0) {
      stats.skipped++;
      continue;
    }

    pendingUpdates.push({
      tickerId: perf?.id ?? "",
      validatedTickerId: ticker.id,
      symbol: ticker.symbol,
      detectionPrice: ticker.price!,
      intervals: dueIntervals,
    });
    symbolsNeeded.add(ticker.symbol);
  }

  if (pendingUpdates.length === 0) {
    console.log("[snapshots] No intervals due for any ticker");
    return stats;
  }

  console.log(`[snapshots] ${pendingUpdates.length} tickers with due intervals, fetching ${symbolsNeeded.size} unique symbols`);

  // 3. Batch-fetch current prices
  const prices = await fetchPricesBatch([...symbolsNeeded]);
  console.log(`[snapshots] Fetched prices for ${prices.size}/${symbolsNeeded.size} symbols`);

  // 4. Dev DB mirroring
  const devPrisma = createDevPrismaClient();

  // 5. Update each ticker's performance record
  for (const pending of pendingUpdates) {
    const currentPrice = prices.get(pending.symbol);
    if (currentPrice == null) {
      console.warn(`[snapshots] No price for ${pending.symbol}, skipping`);
      stats.errors++;
      continue;
    }

    try {
      const updateData: Record<string, number | Date> = {};
      for (const iv of pending.intervals) {
        updateData[iv.priceField] = currentPrice;
        updateData[iv.returnField] = (currentPrice - pending.detectionPrice) / pending.detectionPrice;
        updateData[iv.snappedField] = now;
      }

      const result = await prisma.tickerPerformance.upsert({
        where: { validatedTickerId: pending.validatedTickerId },
        create: {
          validatedTickerId: pending.validatedTickerId,
          symbol: pending.symbol,
          detectionPrice: pending.detectionPrice,
          ...updateData,
        },
        update: updateData,
      });

      stats.filled++;

      // Mirror to dev DB
      if (devPrisma) {
        try {
          await devPrisma.tickerPerformance.upsert({
            where: { validatedTickerId: pending.validatedTickerId },
            create: {
              id: result.id,
              validatedTickerId: pending.validatedTickerId,
              symbol: pending.symbol,
              detectionPrice: pending.detectionPrice,
              ...updateData,
            },
            update: updateData,
          });
        } catch (devErr) {
          console.warn(
            `[snapshots] Dev DB write failed for ${pending.symbol}:`,
            devErr instanceof Error ? devErr.message : devErr
          );
        }
      }
    } catch (err) {
      console.error(
        `[snapshots] Failed to update ${pending.symbol}:`,
        err instanceof Error ? err.message : err
      );
      stats.errors++;
    }
  }

  if (devPrisma) {
    await (devPrisma as PrismaClient).$disconnect();
  }

  console.log(`[snapshots] Done: ${stats.filled} filled, ${stats.errors} errors, ${stats.skipped} skipped`);
  return stats;
}
