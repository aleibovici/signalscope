import { prisma } from "@/lib/prisma";
import { getBrokerClient } from "./factory";
import type { ValidatedTicker } from "@/generated/prisma/client";

const POSITION_SIZE_USD = 1000;
const PROVIDER = process.env.BROKER_PROVIDER ?? "alpaca";

export interface ExecutionResult {
  symbol: string;
  status: "placed" | "skipped" | "error";
  reason?: string;
  clientOrderId?: string;
}

export async function executeForTickers(tickers: ValidatedTicker[]): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  const [openPositions, existingOrders] = await Promise.all([
    prisma.brokerPosition.findMany({ where: { closedAt: null }, select: { symbol: true } }),
    prisma.brokerOrder.findMany({
      where: {
        validatedTickerId: { in: tickers.map((t) => t.id) },
        role: "PARENT",
      },
      select: { validatedTickerId: true },
    }),
  ]);

  const openSymbols = new Set(openPositions.map((p) => p.symbol));
  const orderedTickerIds = new Set(existingOrders.map((o) => o.validatedTickerId));

  const client = getBrokerClient();

  for (const ticker of tickers) {
    const { id, symbol, tradeSetupEntryHi, tradeSetupStopLoss, tradeSetupTarget1 } = ticker;

    if (!tradeSetupEntryHi || !tradeSetupStopLoss || !tradeSetupTarget1) {
      results.push({ symbol, status: "skipped", reason: "incomplete trade setup" });
      continue;
    }
    if (orderedTickerIds.has(id)) {
      results.push({ symbol, status: "skipped", reason: "order already placed for this ticker" });
      continue;
    }
    if (openSymbols.has(symbol)) {
      results.push({ symbol, status: "skipped", reason: "open position already exists" });
      continue;
    }

    const qty = Math.floor(POSITION_SIZE_USD / tradeSetupEntryHi);
    if (qty < 1) {
      results.push({ symbol, status: "skipped", reason: `price $${tradeSetupEntryHi} too high for $${POSITION_SIZE_USD} leg` });
      continue;
    }

    try {
      const { clientOrderId, brokerOrderId } = await client.placeBracketOrder({
        symbol,
        qty,
        entryLimit: tradeSetupEntryHi,
        stopPrice: tradeSetupStopLoss,
        targetPrice: tradeSetupTarget1,
      });

      await prisma.$transaction([
        prisma.brokerOrder.create({
          data: {
            validatedTickerId: id,
            symbol,
            role: "PARENT",
            orderType: "LMT",
            side: "BUY",
            quantity: qty,
            limitPrice: tradeSetupEntryHi,
            cOID: clientOrderId,
            brokerOrderId: brokerOrderId ?? null,
            ibkrStatus: "Submitted",
            provider: PROVIDER,
          },
        }),
        prisma.brokerOrder.create({
          data: {
            validatedTickerId: id,
            symbol,
            role: "STOP",
            orderType: "STP",
            side: "SELL",
            quantity: qty,
            stopPrice: tradeSetupStopLoss,
            parentOrderId: clientOrderId,
            ibkrStatus: "PendingSubmit",
            provider: PROVIDER,
          },
        }),
        prisma.brokerOrder.create({
          data: {
            validatedTickerId: id,
            symbol,
            role: "TARGET",
            orderType: "LMT",
            side: "SELL",
            quantity: qty,
            limitPrice: tradeSetupTarget1,
            parentOrderId: clientOrderId,
            ibkrStatus: "PendingSubmit",
            provider: PROVIDER,
          },
        }),
      ]);

      await prisma.brokerPosition.upsert({
        where: { symbol },
        create: {
          symbol,
          quantity: qty,
          avgCost: tradeSetupEntryHi,
          openedAt: new Date(),
          syncedAt: new Date(),
          provider: PROVIDER,
        },
        update: {
          quantity: qty,
          avgCost: tradeSetupEntryHi,
          closedAt: null,
          openedAt: new Date(),
          syncedAt: new Date(),
          provider: PROVIDER,
        },
      });

      openSymbols.add(symbol);
      results.push({ symbol, status: "placed", clientOrderId });
      console.log(`[broker/executor] ✓ ${symbol} — ${qty} sh @ $${tradeSetupEntryHi}, stop $${tradeSetupStopLoss}, target $${tradeSetupTarget1} [${PROVIDER}]`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[broker/executor] ✗ ${symbol} — ${msg}`);
      await prisma.brokerOrder.create({
        data: {
          validatedTickerId: id,
          symbol,
          role: "PARENT",
          orderType: "LMT",
          side: "BUY",
          quantity: qty,
          limitPrice: tradeSetupEntryHi,
          ibkrStatus: "Error",
          errorMessage: msg,
          provider: PROVIDER,
        },
      });
      results.push({ symbol, status: "error", reason: msg });
    }
  }

  return results;
}
