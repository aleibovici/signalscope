import { prisma, createDevPrismaClient } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { yahooFinance, withYahooTimeout } from "@/lib/yahoo-finance";
import { computeReturnsFromSnapshots, detectCorporateAction } from "./returns";

const TRACKING_DAYS = 30;

async function fetchPricesBatch(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50);
    try {
      const quotes = await withYahooTimeout(yahooFinance.quote(batch));
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
  const trackingCutoff = new Date(now.getTime() - TRACKING_DAYS * 24 * 60 * 60 * 1000);

  // 1. Get eligible ticker IDs without loading snapshots (lightweight query)
  const trackable = await prisma.validatedTicker.findMany({
    where: {
      createdAt: { gte: trackingCutoff },
      price: { not: null },
    },
    select: { id: true, symbol: true, price: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (trackable.length === 0) {
    console.log("[snapshots] No tickers within tracking window");
    return stats;
  }

  const symbols = [...new Set(trackable.map((t) => t.symbol))];
  console.log(`[snapshots] ${trackable.length} tickers within ${TRACKING_DAYS}d window, fetching ${symbols.length} unique symbols`);

  // 2. Batch-fetch current prices
  const prices = await fetchPricesBatch(symbols);
  console.log(`[snapshots] Fetched prices for ${prices.size}/${symbols.length} symbols`);

  // 3. Dev DB mirroring
  const devPrisma = createDevPrismaClient();

  // 4. Batch-insert all price snapshots in one round-trip
  const snapshotBatch = trackable
    .filter((t) => {
      if (prices.get(t.symbol) == null) {
        console.warn(`[snapshots] No price for ${t.symbol}, skipping`);
        stats.errors++;
        return false;
      }
      return true;
    })
    .map((t) => ({ validatedTickerId: t.id, symbol: t.symbol, price: prices.get(t.symbol)! }));

  const createdSnapshots = snapshotBatch.length > 0
    ? await prisma.priceSnapshot.createManyAndReturn({
        data: snapshotBatch,
        select: { id: true, validatedTickerId: true },
      })
    : [];
  stats.filled = createdSnapshots.length;

  const snapshotIdByTickerId = new Map(createdSnapshots.map((s) => [s.validatedTickerId, s.id]));

  // 5. Process tickers in chunks to avoid OOM — load snapshots per chunk
  const CHUNK_SIZE = 100;
  for (let i = 0; i < trackable.length; i += CHUNK_SIZE) {
    const chunk = trackable.slice(i, i + CHUNK_SIZE);
    const chunkIds = chunk.map((t) => t.id);

    // Load snapshots only for this chunk
    const snapshotRows = await prisma.priceSnapshot.findMany({
      where: { validatedTickerId: { in: chunkIds } },
      select: { validatedTickerId: true, price: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const snapshotsByTickerId = new Map<string, { price: number; createdAt: Date }[]>();
    for (const s of snapshotRows) {
      let arr = snapshotsByTickerId.get(s.validatedTickerId);
      if (!arr) { arr = []; snapshotsByTickerId.set(s.validatedTickerId, arr); }
      arr.push({ price: s.price, createdAt: s.createdAt });
    }

    for (const ticker of chunk) {
      const currentPrice = prices.get(ticker.symbol);
      if (currentPrice == null) continue;

      try {
        const snapshotId = snapshotIdByTickerId.get(ticker.id)!;
        const existingSnapshots = snapshotsByTickerId.get(ticker.id) ?? [];
        const allSnapshots = [...existingSnapshots, { price: currentPrice, createdAt: now }];
        const detectionPrice = ticker.price!;
        const detectedAt = new Date(ticker.createdAt);

        // Check for corporate actions (reverse splits, mergers, etc.)
        const isCorporateAction = detectCorporateAction(allSnapshots, detectionPrice);
        if (isCorporateAction) {
          console.warn(`[snapshots] Corporate action detected for ${ticker.symbol} — nulling returns`);
          await prisma.tickerPerformance.upsert({
            where: { validatedTickerId: ticker.id },
            create: {
              validatedTickerId: ticker.id,
              symbol: ticker.symbol,
              detectionPrice,
              corporateActionDetected: true,
            },
            update: {
              corporateActionDetected: true,
              return1d: null, return3d: null, return7d: null, return30d: null,
              price1d: null, price3d: null, price7d: null, price30d: null,
              snapped1dAt: null, snapped3dAt: null, snapped7dAt: null, snapped30dAt: null,
            },
          });
          stats.returnsUpdated++;

          // Mirror to dev DB
          if (devPrisma) {
            try {
              await devPrisma.tickerPerformance.upsert({
                where: { validatedTickerId: ticker.id },
                create: {
                  validatedTickerId: ticker.id,
                  symbol: ticker.symbol,
                  detectionPrice,
                  corporateActionDetected: true,
                },
                update: {
                  corporateActionDetected: true,
                  return1d: null, return3d: null, return7d: null, return30d: null,
                  price1d: null, price3d: null, price7d: null, price30d: null,
                  snapped1dAt: null, snapped3dAt: null, snapped7dAt: null, snapped30dAt: null,
                },
              });
            } catch (devErr) {
              console.warn(
                `[snapshots] Dev DB corporate action write failed for ${ticker.symbol}:`,
                devErr instanceof Error ? devErr.message : devErr
              );
            }
          }

          continue;
        }

        const returns = computeReturnsFromSnapshots(allSnapshots, detectionPrice, detectedAt, now);

        // Update TickerPerformance with computed returns
        const updateData: Record<string, number | Date | boolean> = {};
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
                id: snapshotId,
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
  }

  if (devPrisma) {
    await (devPrisma as PrismaClient).$disconnect();
  }

  console.log(`[snapshots] Done: ${stats.filled} snapshots, ${stats.returnsUpdated} returns updated, ${stats.errors} errors, ${stats.skipped} skipped`);
  return stats;
}
