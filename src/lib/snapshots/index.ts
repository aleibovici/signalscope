import { prisma, createDevPrismaClient } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import YahooFinance from "yahoo-finance2";
import { computeReturnsFromSnapshots } from "./returns";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const TRACKING_DAYS = 30;

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

export async function collectSnapshots(): Promise<{ filled: number; errors: number; skipped: number; returnsUpdated: number }> {
  const stats = { filled: 0, errors: 0, skipped: 0, returnsUpdated: 0 };
  const now = new Date();
  const cutoff = new Date(now.getTime() - (TRACKING_DAYS + 5) * 24 * 60 * 60 * 1000);

  // 1. Get all eligible validated tickers from the tracking window
  const tickers = await prisma.validatedTicker.findMany({
    where: {
      createdAt: { gte: cutoff },
      price: { not: null },
    },
    include: {
      performance: true,
      priceSnapshots: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[snapshots] Found ${tickers.length} eligible tickers from last ${TRACKING_DAYS + 5} days`);

  // 2. Filter to tickers that still need tracking (within 30 days of detection)
  const trackable = tickers.filter((t) => {
    const ageMs = now.getTime() - new Date(t.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays <= TRACKING_DAYS;
  });

  if (trackable.length === 0) {
    console.log("[snapshots] No tickers within tracking window");
    return stats;
  }

  const symbols = [...new Set(trackable.map((t) => t.symbol))];
  console.log(`[snapshots] ${trackable.length} tickers within ${TRACKING_DAYS}d window, fetching ${symbols.length} unique symbols`);

  // 3. Batch-fetch current prices
  const prices = await fetchPricesBatch(symbols);
  console.log(`[snapshots] Fetched prices for ${prices.size}/${symbols.length} symbols`);

  // 4. Dev DB mirroring
  const devPrisma = createDevPrismaClient();

  // 5. Create snapshot + update returns for each ticker
  for (const ticker of trackable) {
    const currentPrice = prices.get(ticker.symbol);
    if (currentPrice == null) {
      console.warn(`[snapshots] No price for ${ticker.symbol}, skipping`);
      stats.errors++;
      continue;
    }

    try {
      // Create a new price snapshot
      const snapshot = await prisma.priceSnapshot.create({
        data: {
          validatedTickerId: ticker.id,
          symbol: ticker.symbol,
          price: currentPrice,
        },
      });

      stats.filled++;

      // Compute returns from all snapshots (including the one we just created)
      const allSnapshots = [...ticker.priceSnapshots, { price: currentPrice, createdAt: now }];
      const detectionPrice = ticker.price!;
      const detectedAt = new Date(ticker.createdAt);
      const returns = computeReturnsFromSnapshots(allSnapshots, detectionPrice, detectedAt, now);

      // Update TickerPerformance with computed returns
      const updateData: Record<string, number | Date> = {};
      if (returns.return1d != null) {
        updateData.price1d = returns.price1d!;
        updateData.return1d = returns.return1d;
        updateData.snapped1dAt = returns.snapped1dAt!;
      }
      if (returns.return3d != null) {
        updateData.price3d = returns.price3d!;
        updateData.return3d = returns.return3d;
        updateData.snapped3dAt = returns.snapped3dAt!;
      }
      if (returns.return7d != null) {
        updateData.price7d = returns.price7d!;
        updateData.return7d = returns.return7d;
        updateData.snapped7dAt = returns.snapped7dAt!;
      }
      if (returns.return30d != null) {
        updateData.price30d = returns.price30d!;
        updateData.return30d = returns.return30d;
        updateData.snapped30dAt = returns.snapped30dAt!;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.tickerPerformance.upsert({
          where: { validatedTickerId: ticker.id },
          create: {
            validatedTickerId: ticker.id,
            symbol: ticker.symbol,
            detectionPrice,
            ...updateData,
          },
          update: updateData,
        });
        stats.returnsUpdated++;
      }

      // Mirror to dev DB
      if (devPrisma) {
        try {
          await devPrisma.priceSnapshot.create({
            data: {
              id: snapshot.id,
              validatedTickerId: ticker.id,
              symbol: ticker.symbol,
              price: currentPrice,
            },
          });
          if (Object.keys(updateData).length > 0) {
            await devPrisma.tickerPerformance.upsert({
              where: { validatedTickerId: ticker.id },
              create: {
                validatedTickerId: ticker.id,
                symbol: ticker.symbol,
                detectionPrice,
                ...updateData,
              },
              update: updateData,
            });
          }
        } catch (devErr) {
          console.warn(
            `[snapshots] Dev DB write failed for ${ticker.symbol}:`,
            devErr instanceof Error ? devErr.message : devErr
          );
        }
      }
    } catch (err) {
      console.error(
        `[snapshots] Failed to update ${ticker.symbol}:`,
        err instanceof Error ? err.message : err
      );
      stats.errors++;
    }
  }

  if (devPrisma) {
    await (devPrisma as PrismaClient).$disconnect();
  }

  console.log(`[snapshots] Done: ${stats.filled} snapshots, ${stats.returnsUpdated} returns updated, ${stats.errors} errors, ${stats.skipped} skipped`);
  return stats;
}
