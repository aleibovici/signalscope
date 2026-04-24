// Route kept at /api/brokers/ibkr/sync for backwards-compat with existing Cloud Scheduler job.
// Internally uses the configured broker provider (currently Alpaca).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { getBrokerClient, isConfigured } from "@/lib/brokers/factory";

const DEFAULT_HOLD_DAYS = 7;

function resolveHoldDays(tf: string | null): number {
  if (!tf) return DEFAULT_HOLD_DAYS;
  const m = tf.toLowerCase().match(/(\d+)/);
  return m ? Math.min(parseInt(m[1]), 30) : DEFAULT_HOLD_DAYS;
}

export async function POST(req: NextRequest) {
  try {
    const key = req.headers.get("x-snapshot-key");
    if (!key || key !== process.env.SNAPSHOT_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isConfigured()) {
      return NextResponse.json({ status: "not_configured" });
    }

    const client = getBrokerClient();
    const now = Date.now();

    const [brokerOrders, brokerPositions] = await Promise.all([
      client.listOpenOrders(),
      client.listPositions(),
    ]);

    // Build symbol lookup for position closure detection
    const liveSymbols = new Set(brokerPositions.map((p) => p.symbol));

    // Sync BrokerOrder statuses — match on brokerOrderId (stored in ibkrOrderId as string via cOID)
    const dbOrders = await prisma.brokerOrder.findMany({
      where: { cOID: { not: null }, cancelledAt: null, filledAt: null },
    });

    let ordersUpdated = 0;
    for (const dbOrder of dbOrders) {
      if (!dbOrder.cOID) continue;
      // For Alpaca, brokerOrderId is stored in ibkrStatus column's parent; look up by cOID in live orders
      const live = brokerOrders.find(
        (o) => o.clientOrderId === dbOrder.cOID || o.brokerOrderId === dbOrder.cOID,
      );
      if (!live) continue;

      const isFilled = ["filled", "Filled"].includes(live.status);
      const isCancelled = ["canceled", "cancelled", "expired", "Cancelled"].includes(live.status);

      await prisma.brokerOrder.update({
        where: { id: dbOrder.id },
        data: {
          ibkrStatus: live.status,
          filledQty: live.filledQty,
          avgFillPrice: live.avgFillPrice > 0 ? live.avgFillPrice : undefined,
          filledAt: isFilled && !dbOrder.filledAt ? new Date() : undefined,
          cancelledAt: isCancelled && !dbOrder.cancelledAt ? new Date() : undefined,
        },
      });
      ordersUpdated++;
    }

    // Sync BrokerPosition from live broker portfolio
    for (const pos of brokerPositions) {
      if (pos.qty === 0) continue;
      await prisma.brokerPosition.upsert({
        where: { symbol: pos.symbol },
        create: {
          symbol: pos.symbol,
          quantity: pos.qty,
          avgCost: pos.avgEntryPrice,
          marketPrice: pos.marketPrice,
          marketValue: pos.marketValue,
          unrealizedPnl: pos.unrealizedPnl,
          openedAt: new Date(),
          syncedAt: new Date(),
          provider: client.provider,
        },
        update: {
          quantity: pos.qty,
          avgCost: pos.avgEntryPrice,
          marketPrice: pos.marketPrice,
          marketValue: pos.marketValue,
          unrealizedPnl: pos.unrealizedPnl,
          syncedAt: new Date(),
        },
      });
    }

    // Mark positions broker no longer holds as closed (bracket triggered or exit executed)
    const openDbPositions = await prisma.brokerPosition.findMany({
      where: { closedAt: null },
    });
    let positionsClosed = 0;
    for (const pos of openDbPositions) {
      if (!liveSymbols.has(pos.symbol)) {
        await prisma.brokerPosition.update({
          where: { symbol: pos.symbol },
          data: { closedAt: new Date(), syncedAt: new Date() },
        });
        positionsClosed++;
      }
    }

    // Time-based exit: flatten positions that have exceeded their hold period
    let timeExits = 0;
    const stillOpen = await prisma.brokerPosition.findMany({ where: { closedAt: null } });

    for (const pos of stillOpen) {
      const ageDays = (now - pos.openedAt.getTime()) / 86400000;
      const parentOrder = await prisma.brokerOrder.findFirst({
        where: { symbol: pos.symbol, role: "PARENT" },
        include: { validatedTicker: { select: { tradeSetupTimeframe: true } } },
        orderBy: { placedAt: "desc" },
      });
      const holdDays = resolveHoldDays(parentOrder?.validatedTicker?.tradeSetupTimeframe ?? null);

      if (ageDays >= holdDays) {
        // Guard: skip if an exit order was already submitted to avoid duplicate sells
        // across sync runs (e.g. after-hours sell expires, position still shows open)
        const existingExit = await prisma.brokerOrder.findFirst({
          where: { symbol: pos.symbol, role: "EXIT_TIMEOUT", cancelledAt: null },
        });
        if (existingExit) {
          console.log(`[broker/sync] Time exit skipped for ${pos.symbol} — exit order already exists`);
          continue;
        }

        try {
          if (pos.quantity > 0) {
            await client.placeMarketSell(pos.symbol, pos.quantity);
          }

          if (parentOrder) {
            await prisma.brokerOrder.create({
              data: {
                validatedTickerId: parentOrder.validatedTickerId,
                symbol: pos.symbol,
                role: "EXIT_TIMEOUT",
                orderType: "MKT",
                side: "SELL",
                quantity: pos.quantity,
                ibkrStatus: "Submitted",
                provider: client.provider,
              },
            });
          }

          timeExits++;
          console.log(`[broker/sync] Time exit: ${pos.symbol} after ${ageDays.toFixed(1)}d`);
        } catch (err) {
          console.error(`[broker/sync] Time exit failed for ${pos.symbol}:`, err instanceof Error ? err.message : err);
        }
      }
    }

    // GC: cancel stale unfilled PARENT orders older than 2 days
    const staleCutoff = new Date(now - 2 * 86400000);
    const staleParents = await prisma.brokerOrder.findMany({
      where: {
        role: "PARENT",
        filledAt: null,
        cancelledAt: null,
        placedAt: { lt: staleCutoff },
        cOID: { not: null },
        ibkrStatus: { in: ["Submitted", "PreSubmitted", "new", "pending_new", "accepted"] },
      },
    });

    let staleCancelled = 0;
    for (const order of staleParents) {
      try {
        const cancelId = order.brokerOrderId ?? order.cOID;
        if (cancelId) await client.cancelOrder(cancelId);
        await prisma.brokerOrder.update({
          where: { id: order.id },
          data: { cancelledAt: new Date(), ibkrStatus: "Cancelled" },
        });
        staleCancelled++;
      } catch (err) {
        console.warn(`[broker/sync] Cancel stale order ${order.symbol} failed:`, err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({
      status: "ok",
      provider: client.provider,
      ordersUpdated,
      positionsSynced: brokerPositions.length,
      positionsClosed,
      timeExits,
      staleCancelled,
    });
  } catch (err) {
    return handleApiError(err, "brokers/sync");
  }
}
