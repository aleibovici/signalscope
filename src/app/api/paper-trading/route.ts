import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stageLabel } from "@/lib/stage-labels";
import {
  closingSnapshotDate,
  computePaperTradeMark,
} from "@/lib/paper-trading-returns";
import {
  fetchSpyTotalReturnDecimal,
  fetchSpyDailyBars,
  spyReturnForTrade,
  SPY_BENCHMARK_SYMBOL,
} from "@/lib/spy-benchmark";

const VALID_MIN_SCORES = new Set([60, 70, 80, 90]);
const VALID_LOOKBACK_DAYS = new Set([3, 7, 14, 30]);

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const params = request.nextUrl.searchParams;

    const minScoreParam = params.get("minScore");
    const minScore = minScoreParam ? Number(minScoreParam) : 70;
    if (!Number.isInteger(minScore) || !VALID_MIN_SCORES.has(minScore)) {
      return NextResponse.json(
        { error: "Invalid minScore. Valid values: 60, 70, 80, 90" },
        { status: 400 },
      );
    }

    const lookbackParam = params.get("lookbackDays");
    const lookbackDays = lookbackParam ? Number(lookbackParam) : 14;
    if (!Number.isInteger(lookbackDays) || !VALID_LOOKBACK_DAYS.has(lookbackDays)) {
      return NextResponse.json(
        { error: "Invalid lookbackDays. Valid values: 3, 7, 14, 30" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const windowStart = new Date(now - lookbackDays * 86400000);
    const windowEnd = new Date(now);
    // Extend detection query by 7 days (max hold) so trades that closed
    // within the lookback window but were detected earlier are included.
    const detectionCutoff = new Date(now - (lookbackDays + 7) * 86400000);

    const [records, spyReturnPct, spyBars] = await Promise.all([
      prisma.tickerPerformance.findMany({
        where: {
          detectionPrice: { gt: 0.01 },
          corporateActionDetected: false,
          validatedTicker: {
            aiScore: { gte: minScore },
            stage: { notIn: ["FILTERED", "UNSCORED"] },
            createdAt: { gte: detectionCutoff },
          },
        },
        distinct: ["symbol"],
        include: {
          validatedTicker: {
            select: {
              aiScore: true,
              opportunityScore: true,
              stage: true,
              symbol: true,
              name: true,
              catalyst: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      fetchSpyTotalReturnDecimal(windowStart, windowEnd),
      fetchSpyDailyBars(detectionCutoff, windowEnd),
    ]);

    const positionSize = 1000;

    const trades = records.map((r) => {
      const vt = r.validatedTicker;
      const detectedAt = new Date(vt.createdAt).getTime();
      const ageDays = (now - detectedAt) / (1000 * 60 * 60 * 24);

      const { status, currentPrice, returnPct, holdDays } = computePaperTradeMark(
        r,
        ageDays,
      );

      const pnl = returnPct !== null ? positionSize * returnPct : null;

      const detectedAtMs = detectedAt;
      const exitSnap = closingSnapshotDate(r, holdDays);
      let closingAtMs: number | null =
        status === "CLOSED" && exitSnap ? exitSnap.getTime() : null;
      if (status === "CLOSED" && closingAtMs === null) {
        closingAtMs = detectedAtMs + 7 * 86400000;
      }
      const closingAt =
        closingAtMs !== null
          ? new Date(closingAtMs).toISOString().slice(0, 10)
          : null;

      const spyRet = spyReturnForTrade(spyBars, vt.createdAt, holdDays);

      return {
        symbol: vt.symbol,
        name: vt.name,
        aiScore: vt.aiScore,
        opportunityScore: vt.opportunityScore,
        stage: stageLabel(vt.stage),
        catalyst: vt.catalyst,
        entryPrice: r.detectionPrice,
        exitPrice: currentPrice,
        returnPct,
        pnl,
        holdDays,
        status,
        detectedAt: vt.createdAt.toISOString().slice(0, 10),
        detectedAtMs,
        closingAt,
        closingAtMs: status === "CLOSED" ? closingAtMs : null,
        spyReturnPct: spyRet,
      };
    });

    // Drop closed trades that exited before the lookback window started
    const windowStartMs = windowStart.getTime();
    const filteredTrades = trades.filter((t) => {
      if (t.status === "OPEN") return true;
      return t.closingAtMs !== null && t.closingAtMs >= windowStartMs;
    });

    const closedTrades = filteredTrades.filter((t) => t.status === "CLOSED");
    const tradesWithReturn = filteredTrades.filter((t) => t.returnPct !== null);
    const wins = tradesWithReturn.filter((t) => t.returnPct! > 0);
    const totalReturn = tradesWithReturn.reduce(
      (sum, t) => sum + (t.returnPct ?? 0),
      0,
    );
    const totalPnl = tradesWithReturn.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const holdDaysMap: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };
    const tradesWithHold = tradesWithReturn.filter((t) => t.holdDays !== null);
    const avgHoldDays =
      tradesWithHold.length > 0
        ? tradesWithHold.reduce((sum, t) => sum + (holdDaysMap[t.holdDays!] ?? 0), 0) /
          tradesWithHold.length
        : null;

    const summary = {
      totalTrades: filteredTrades.length,
      closedTrades: closedTrades.length,
      openTrades: filteredTrades.length - closedTrades.length,
      tradesWithMark: tradesWithReturn.length,
      winRate: tradesWithReturn.length > 0 ? wins.length / tradesWithReturn.length : 0,
      avgReturn:
        tradesWithReturn.length > 0 ? totalReturn / tradesWithReturn.length : 0,
      totalPnl,
      avgHoldDays,
      positionSize,
    };

    const tradesWithSpyReturn = filteredTrades.filter(
      (t) => t.spyReturnPct !== null && t.returnPct !== null,
    );
    const matchedSpyAvg =
      tradesWithSpyReturn.length > 0
        ? tradesWithSpyReturn.reduce(
            (sum, t) => sum + (t.spyReturnPct ?? 0),
            0,
          ) / tradesWithSpyReturn.length
        : null;

    const benchmark = {
      symbol: SPY_BENCHMARK_SYMBOL,
      returnPct: spyReturnPct,
      matchedReturnPct: matchedSpyAvg,
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
    };

    return NextResponse.json({ summary, trades: filteredTrades, benchmark });
  } catch (err) {
    return handleApiError(err, "paper-trading");
  }
}
