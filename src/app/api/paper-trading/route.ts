import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stageLabel } from "@/lib/stage-labels";
import {
  closingSnapshotDate,
  computePaperTradeMark,
} from "@/lib/paper-trading-returns";
import {
  fetchSpyTotalReturnDecimal,
  SPY_BENCHMARK_SYMBOL,
} from "@/lib/spy-benchmark";

const VALID_MIN_SCORES = new Set([60, 70, 80, 90]);

const THIRTY_DAYS_MS = 30 * 86400000;

export async function GET(request: NextRequest) {
  try {
    await getOptionalUserId();
    const params = request.nextUrl.searchParams;

    const minScoreParam = params.get("minScore");
    const minScore = minScoreParam ? Number(minScoreParam) : 70;
    if (!Number.isInteger(minScore) || !VALID_MIN_SCORES.has(minScore)) {
      return NextResponse.json(
        { error: "Invalid minScore. Valid values: 60, 70, 80, 90" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const detectionCutoff = new Date(now - THIRTY_DAYS_MS);
    const windowEnd = new Date(now);

    const [records, spyReturnPct] = await Promise.all([
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
      fetchSpyTotalReturnDecimal(detectionCutoff, windowEnd),
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
      };
    });

    const closedTrades = trades.filter((t) => t.status === "CLOSED");
    const tradesWithReturn = trades.filter((t) => t.returnPct !== null);
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
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      openTrades: trades.length - closedTrades.length,
      tradesWithMark: tradesWithReturn.length,
      winRate: tradesWithReturn.length > 0 ? wins.length / tradesWithReturn.length : 0,
      avgReturn:
        tradesWithReturn.length > 0 ? totalReturn / tradesWithReturn.length : 0,
      totalPnl,
      avgHoldDays,
      positionSize,
    };

    const benchmark = {
      symbol: SPY_BENCHMARK_SYMBOL,
      returnPct: spyReturnPct,
      windowStart: detectionCutoff.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
    };

    return NextResponse.json({ summary, trades, benchmark });
  } catch (err) {
    return handleApiError(err, "paper-trading");
  }
}
