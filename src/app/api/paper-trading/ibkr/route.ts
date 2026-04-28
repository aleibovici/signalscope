import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { fetchSpyTotalReturnDecimal, fetchSpyDailyBars, spyReturnForDateRange } from "@/lib/spy-benchmark";
import { getBrokerClient, isConfigured } from "@/lib/brokers/factory";
import { AlpacaClient } from "@/lib/brokers/alpaca/client";
import type { BrokerAccount, BrokerPortfolioHistory } from "@/lib/brokers/interface";

export async function GET() {
  try {
    // Fetch all broker positions (open and recently closed)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [positions, orders] = await Promise.all([
      prisma.brokerPosition.findMany({
        where: {
          OR: [
            { closedAt: null },
            { closedAt: { gte: thirtyDaysAgo } },
          ],
        },
        orderBy: { openedAt: "desc" },
      }),
      prisma.brokerOrder.findMany({
        where: {
          role: "PARENT",
          placedAt: { gte: thirtyDaysAgo },
        },
        include: {
          validatedTicker: {
            select: {
              aiScore: true,
              opportunityScore: true,
              stage: true,
              name: true,
              catalyst: true,
              recommendation: true,
              tradeSetupEntryHi: true,
              tradeSetupStopLoss: true,
              tradeSetupTarget1: true,
              tradeSetupTimeframe: true,
              tradeSetupConfidence: true,
              tradeSetupRiskReward: true,
            },
          },
        },
        orderBy: { placedAt: "desc" },
      }),
    ]);

    // Build a map of symbol → latest parent order
    const orderBySymbol = new Map<string, (typeof orders)[0]>();
    for (const order of orders) {
      if (!orderBySymbol.has(order.symbol)) {
        orderBySymbol.set(order.symbol, order);
      }
    }

    const now = Date.now();
    const windowStart = new Date(now - 30 * 86400000);
    const windowEnd = new Date(now);

    let account: BrokerAccount | null = null;
    let portfolioHistory: BrokerPortfolioHistory | null = null;

    const [spyReturnPct, spyBars] = await Promise.all([
      fetchSpyTotalReturnDecimal(windowStart, windowEnd),
      fetchSpyDailyBars(windowStart, windowEnd),
    ]);

    if (isConfigured()) {
      const client = getBrokerClient();
      await Promise.all([
        client.getAccount().then((a) => { account = a; }).catch(() => {}),
        client instanceof AlpacaClient
          ? client.getPortfolioHistory("1M").then((h) => { portfolioHistory = h; }).catch(() => {})
          : Promise.resolve(),
      ]);
    }

    const trades = positions.map((pos) => {
      const order = orderBySymbol.get(pos.symbol);
      const vt = order?.validatedTicker;
      const status = pos.closedAt ? "CLOSED" : "OPEN";

      const entryPrice = pos.avgCost;
      const exitPrice = pos.marketPrice ?? null;
      const returnPct =
        pos.closedAt && pos.marketPrice
          ? (pos.marketPrice - entryPrice) / entryPrice
          : !pos.closedAt && pos.marketPrice
            ? (pos.marketPrice - entryPrice) / entryPrice
            : null;

      const holdMs = pos.closedAt
        ? pos.closedAt.getTime() - pos.openedAt.getTime()
        : now - pos.openedAt.getTime();
      const holdDays = Math.round(holdMs / 86400000);
      const pnl = returnPct !== null ? 1000 * returnPct : null;

      const exitMs = pos.closedAt ? pos.closedAt.getTime() : now;
      const spyReturnPct = returnPct !== null
        ? spyReturnForDateRange(spyBars, pos.openedAt.getTime(), exitMs)
        : null;

      return {
        symbol: pos.symbol,
        name: vt?.name ?? null,
        aiScore: vt?.aiScore ?? null,
        stage: vt?.stage ?? null,
        recommendation: vt?.recommendation ?? null,
        catalyst: vt?.catalyst ?? null,
        entryPrice,
        exitPrice,
        quantity: pos.quantity,
        returnPct,
        pnl,
        unrealizedPnl: pos.unrealizedPnl ?? null,
        realizedPnl: pos.realizedPnl,
        holdDays,
        status,
        spyReturnPct,
        openedAt: pos.openedAt.toISOString().slice(0, 10),
        closedAt: pos.closedAt?.toISOString().slice(0, 10) ?? null,
        tradeSetup: vt
          ? {
              entryHi: vt.tradeSetupEntryHi,
              stopLoss: vt.tradeSetupStopLoss,
              target1: vt.tradeSetupTarget1,
              timeframe: vt.tradeSetupTimeframe,
              confidence: vt.tradeSetupConfidence,
              riskReward: vt.tradeSetupRiskReward,
            }
          : null,
      };
    });

    const closedTrades = trades.filter((t) => t.status === "CLOSED");
    const openTrades = trades.filter((t) => t.status === "OPEN");
    const tradesWithReturn = trades.filter((t) => t.returnPct !== null);
    const closedWithReturn = closedTrades.filter((t) => t.returnPct !== null);
    const wins = closedWithReturn.filter((t) => t.returnPct! > 0);
    const totalPnl = tradesWithReturn.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const avgReturn =
      tradesWithReturn.length > 0
        ? tradesWithReturn.reduce((sum, t) => sum + (t.returnPct ?? 0), 0) / tradesWithReturn.length
        : 0;

    const summary = {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      tradesWithMark: tradesWithReturn.length,
      winRate: closedWithReturn.length > 0 ? wins.length / closedWithReturn.length : 0,
      avgReturn,
      totalPnl,
      positionSize: 1000,
    };

    const tradesWithMatchedSpy = trades.filter(
      (t) => t.spyReturnPct !== null && t.returnPct !== null,
    );
    const matchedReturnPct =
      tradesWithMatchedSpy.length > 0
        ? tradesWithMatchedSpy.reduce((sum, t) => sum + t.spyReturnPct!, 0) / tradesWithMatchedSpy.length
        : null;

    const benchmark = {
      symbol: "SPY",
      returnPct: spyReturnPct,
      matchedReturnPct,
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
    };

    return NextResponse.json({ summary, trades, benchmark, account, portfolioHistory, isLive: true });
  } catch (err) {
    return handleApiError(err, "paper-trading/ibkr");
  }
}
