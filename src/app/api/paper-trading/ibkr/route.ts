import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { fetchSpyTotalReturnDecimal, fetchSpyDailyBars, spyReturnForDateRange } from "@/lib/spy-benchmark";
import { getBrokerClient, isConfigured } from "@/lib/brokers/factory";
import { AlpacaClient } from "@/lib/brokers/alpaca/client";
import type {
  BrokerAccount,
  BrokerPortfolioHistory,
  BrokerOrderStatus,
  BrokerPositionStatus,
} from "@/lib/brokers/interface";

interface ReconstructedRound {
  symbol: string;
  status: "OPEN" | "CLOSED";
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  openedAt: Date;
  closedAt: Date | null;
  unrealizedPnl: number | null;
  pnl: number | null;
  returnPct: number | null;
}

// Walk a symbol's filled orders chronologically, splitting into round-trips.
// A round opens on a BUY when running qty is 0, accumulates further BUYs/SELLs,
// and closes when running qty returns to 0.
function reconstructRounds(
  symbol: string,
  fills: BrokerOrderStatus[],
  openPosition: BrokerPositionStatus | undefined,
  nowMs: number,
): ReconstructedRound[] {
  const sorted = fills
    .slice()
    .sort((a, b) => (a.filledAt?.getTime() ?? 0) - (b.filledAt?.getTime() ?? 0));

  const rounds: ReconstructedRound[] = [];
  let buys: BrokerOrderStatus[] = [];
  let sells: BrokerOrderStatus[] = [];
  let qty = 0;

  const flush = (closedAt: Date | null) => {
    if (buys.length === 0) return;
    const totalBuyQty = buys.reduce((s, b) => s + b.filledQty, 0);
    const totalSellQty = sells.reduce((s, b) => s + b.filledQty, 0);
    const wAvgEntry =
      totalBuyQty > 0
        ? buys.reduce((s, b) => s + b.avgFillPrice * b.filledQty, 0) / totalBuyQty
        : 0;
    const wAvgExit =
      totalSellQty > 0
        ? sells.reduce((s, b) => s + b.avgFillPrice * b.filledQty, 0) / totalSellQty
        : null;

    if (closedAt) {
      const ret = wAvgExit !== null ? (wAvgExit - wAvgEntry) / wAvgEntry : null;
      const pnl = wAvgExit !== null ? (wAvgExit - wAvgEntry) * totalSellQty : null;
      rounds.push({
        symbol,
        status: "CLOSED",
        entryPrice: wAvgEntry,
        exitPrice: wAvgExit,
        quantity: totalSellQty || totalBuyQty,
        openedAt: buys[0].filledAt ?? new Date(nowMs),
        closedAt,
        unrealizedPnl: null,
        pnl,
        returnPct: ret,
      });
    }
    buys = [];
    sells = [];
    qty = 0;
  };

  for (const f of sorted) {
    if (f.side === "buy") {
      buys.push(f);
      qty += f.filledQty;
    } else {
      sells.push(f);
      qty -= f.filledQty;
      if (qty <= 0 && (buys.length > 0 || sells.length > 0)) {
        flush(f.filledAt ?? new Date(nowMs));
      }
    }
  }

  // If running qty > 0, the trailing buys are the OPEN position. Use Alpaca's
  // current /v2/positions data for entry/current price (Alpaca already weight-
  // averages avg_entry_price across multiple buys, including any that pre-date
  // our 30d order-history window).
  if (openPosition) {
    const ret =
      (openPosition.marketPrice - openPosition.avgEntryPrice) / openPosition.avgEntryPrice;
    const openedAt = buys.length > 0 ? buys[0].filledAt ?? new Date(nowMs) : new Date(nowMs);
    rounds.push({
      symbol: openPosition.symbol,
      status: "OPEN",
      entryPrice: openPosition.avgEntryPrice,
      exitPrice: openPosition.marketPrice,
      quantity: openPosition.qty,
      openedAt,
      closedAt: null,
      unrealizedPnl: openPosition.unrealizedPnl,
      pnl: openPosition.unrealizedPnl,
      returnPct: ret,
    });
  }

  return rounds;
}

export async function GET() {
  try {
    const now = Date.now();
    const windowStart = new Date(now - 30 * 86400000);
    const windowEnd = new Date(now);

    let positions: BrokerPositionStatus[] = [];
    let closedOrders: BrokerOrderStatus[] = [];
    let account: BrokerAccount | null = null;
    let portfolioHistory: BrokerPortfolioHistory | null = null;

    const brokerCalls: Promise<unknown>[] = [];
    if (isConfigured()) {
      const client = getBrokerClient();
      brokerCalls.push(
        client.listPositions().then((p) => { positions = p; }).catch(() => {}),
        client
          .listClosedOrders(windowStart.toISOString())
          .then((o) => { closedOrders = o; })
          .catch(() => {}),
        client.getAccount().then((a) => { account = a; }).catch(() => {}),
        client instanceof AlpacaClient
          ? client.getPortfolioHistory("1M").then((h) => { portfolioHistory = h; }).catch(() => {})
          : Promise.resolve(),
      );
    }

    const [spyReturnPct, spyBars] = await Promise.all([
      fetchSpyTotalReturnDecimal(windowStart, windowEnd),
      fetchSpyDailyBars(windowStart, windowEnd),
      ...brokerCalls,
    ]);

    // Group fills by symbol — keep only orders with real fills
    const fillsBySymbol = new Map<string, BrokerOrderStatus[]>();
    for (const o of closedOrders) {
      if (o.filledQty <= 0 || !o.filledAt || o.avgFillPrice <= 0) continue;
      const list = fillsBySymbol.get(o.symbol) ?? [];
      list.push(o);
      fillsBySymbol.set(o.symbol, list);
    }

    const positionBySymbol = new Map(positions.map((p) => [p.symbol, p]));
    const allSymbols = new Set<string>([
      ...fillsBySymbol.keys(),
      ...positionBySymbol.keys(),
    ]);

    const rounds: ReconstructedRound[] = [];
    for (const symbol of allSymbols) {
      const fills = fillsBySymbol.get(symbol) ?? [];
      const openPos = positionBySymbol.get(symbol);
      rounds.push(...reconstructRounds(symbol, fills, openPos, now));
    }

    // Drop closed rounds whose close fell outside the 30d window
    const filtered = rounds.filter(
      (r) => r.status === "OPEN" || (r.closedAt && r.closedAt.getTime() >= windowStart.getTime()),
    );

    // Pull metadata for every symbol that ended up in the result
    const symbolList = Array.from(new Set(filtered.map((r) => r.symbol)));
    const tickers =
      symbolList.length > 0
        ? await prisma.validatedTicker.findMany({
            where: { symbol: { in: symbolList } },
            select: {
              symbol: true,
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
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    const tickerBySymbol = new Map<string, (typeof tickers)[0]>();
    for (const t of tickers) {
      if (!tickerBySymbol.has(t.symbol)) tickerBySymbol.set(t.symbol, t);
    }

    const trades = filtered.map((r) => {
      const vt = tickerBySymbol.get(r.symbol);
      const exitMs = r.closedAt?.getTime() ?? now;
      const holdMs = exitMs - r.openedAt.getTime();
      const holdDays = Math.max(0, Math.round(holdMs / 86400000));
      const spyRet = spyReturnForDateRange(spyBars, r.openedAt.getTime(), exitMs);

      return {
        symbol: r.symbol,
        name: vt?.name ?? null,
        aiScore: vt?.aiScore ?? null,
        stage: vt?.stage ?? null,
        recommendation: vt?.recommendation ?? null,
        catalyst: vt?.catalyst ?? null,
        entryPrice: r.entryPrice,
        exitPrice: r.exitPrice,
        quantity: r.quantity,
        returnPct: r.returnPct,
        pnl: r.pnl,
        unrealizedPnl: r.unrealizedPnl,
        realizedPnl: r.status === "CLOSED" ? r.pnl : null,
        holdDays,
        status: r.status,
        spyReturnPct: spyRet,
        openedAt: r.openedAt.toISOString().slice(0, 10),
        closedAt: r.closedAt?.toISOString().slice(0, 10) ?? null,
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

    trades.sort((a, b) => (a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0));

    const closedTrades = trades.filter((t) => t.status === "CLOSED");
    const openTrades = trades.filter((t) => t.status === "OPEN");
    const tradesWithReturn = trades.filter((t) => t.returnPct !== null);
    const closedWithReturn = closedTrades.filter((t) => t.returnPct !== null);
    const wins = closedWithReturn.filter((t) => t.returnPct! > 0);
    const totalPnl = tradesWithReturn.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    // Capital-weighted average return: actual dollar return on deployed capital,
    // not a simple mean of per-trade percentages. Reflects portfolio reality.
    const totalInvested = tradesWithReturn.reduce(
      (sum, t) => sum + t.entryPrice * t.quantity,
      0,
    );
    const avgReturn = totalInvested > 0 ? totalPnl / totalInvested : 0;

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
