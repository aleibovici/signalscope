import { prisma } from "@/lib/prisma";
import { getBrokerClient } from "./factory";
import { resolveTradeBracket } from "@/lib/anchors";
import type { ValidatedTicker } from "@/generated/prisma/client";

const POSITION_SIZE_USD = 1000;
const PROVIDER = process.env.BROKER_PROVIDER ?? "alpaca";
const round2 = (n: number) => Math.round(n * 100) / 100;

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
    const { id, symbol } = ticker;

    if (orderedTickerIds.has(id)) {
      results.push({ symbol, status: "skipped", reason: "order already placed for this ticker" });
      continue;
    }
    if (openSymbols.has(symbol)) {
      results.push({ symbol, status: "skipped", reason: "open position already exists" });
      continue;
    }

    let entryLimit = ticker.tradeSetupEntryHi;
    let stopPrice = ticker.tradeSetupStopLoss;
    let targetPrice = ticker.tradeSetupTarget1;

    if (!entryLimit || !stopPrice || !targetPrice) {
      // No AI-generated trade setup — build bracket from current price with a 0.5% buffer
      if (!ticker.price || ticker.price <= 0) {
        results.push({ symbol, status: "skipped", reason: "no trade setup and no price for fallback bracket" });
        continue;
      }
      const bracket = await resolveTradeBracket(ticker.stage);
      entryLimit = round2(ticker.price * 1.005);
      stopPrice = round2(entryLimit * (1 + bracket.stopPct));
      targetPrice = round2(entryLimit * (1 + bracket.targetPct));
      console.log(`[broker/executor] ${symbol} — fallback bracket (price=$${ticker.price}, entry=$${entryLimit})`);
    }

    const qty = Math.floor(POSITION_SIZE_USD / entryLimit);
    if (qty < 1) {
      results.push({ symbol, status: "skipped", reason: `price $${entryLimit} too high for $${POSITION_SIZE_USD} leg` });
      continue;
    }

    try {
      const { clientOrderId, brokerOrderId } = await client.placeBracketOrder({
        symbol,
        qty,
        entryLimit,
        stopPrice,
        targetPrice,
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
            limitPrice: entryLimit,
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
            stopPrice,
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
            limitPrice: targetPrice,
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
          avgCost: entryLimit,
          openedAt: new Date(),
          syncedAt: new Date(),
          provider: PROVIDER,
        },
        update: {
          quantity: qty,
          avgCost: entryLimit,
          closedAt: null,
          openedAt: new Date(),
          syncedAt: new Date(),
          provider: PROVIDER,
        },
      });

      openSymbols.add(symbol);
      results.push({ symbol, status: "placed", clientOrderId });
      console.log(`[broker/executor] ✓ ${symbol} — ${qty} sh @ $${entryLimit}, stop $${stopPrice}, target $${targetPrice} [${PROVIDER}]`);
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
          limitPrice: entryLimit,
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
