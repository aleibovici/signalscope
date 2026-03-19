import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

/**
 * Public endpoint — returns aggregate performance stats for the landing page.
 * No auth required. Cached for 10 minutes.
 */

type ReturnCol = "return1d" | "return3d" | "return7d" | "return30d";

interface PerfRecord {
  symbol: string;
  detectionPrice: number;
  return7d: number | null;
  validatedTicker: {
    aiScore: number;
    stage: string;
    createdAt: Date;
  };
}

export async function GET() {
  try {
    const records: PerfRecord[] = await prisma.tickerPerformance.findMany({
      where: {
        detectionPrice: { gt: 0.01 },
        validatedTicker: {
          stage: { notIn: ["FILTERED", "UNSCORED"] },
        },
      },
      distinct: ["symbol"],
      select: {
        symbol: true,
        detectionPrice: true,
        return7d: true,
        validatedTicker: {
          select: {
            aiScore: true,
            stage: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const col: ReturnCol = "return7d";
    const withReturn = records.filter((r) => r[col] !== null);

    if (withReturn.length === 0) {
      return NextResponse.json(
        { totalTracked: 0, winRate: 0, avgReturn: 0, earlyWinRate: 0, earlyAvgReturn: 0, cumulativeReturns: [] },
        { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
      );
    }

    // Overall stats
    const returns = withReturn.map((r) => r[col] as number);
    const wins = returns.filter((r) => r > 0).length;
    const winRate = wins / returns.length;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Early-stage stats (emerging only)
    const earlyRecords = withReturn.filter((r) => r.validatedTicker.stage === "EARLY");
    const earlyReturns = earlyRecords.map((r) => r[col] as number);
    const earlyWins = earlyReturns.filter((r) => r > 0).length;
    const earlyWinRate = earlyReturns.length > 0 ? earlyWins / earlyReturns.length : 0;
    const earlyAvgReturn = earlyReturns.length > 0
      ? earlyReturns.reduce((a, b) => a + b, 0) / earlyReturns.length
      : 0;

    // Cumulative avg return by detection date — emerging signals only
    const earlyWithReturn = withReturn.filter((r) => r.validatedTicker.stage === "EARLY");
    const sorted = [...earlyWithReturn].sort(
      (a, b) =>
        a.validatedTicker.createdAt.getTime() -
        b.validatedTicker.createdAt.getTime(),
    );
    const byDate = new Map<string, { sum: number; count: number }>();
    let runningSum = 0;
    let runningCount = 0;
    for (const r of sorted) {
      const date = r.validatedTicker.createdAt.toISOString().slice(0, 10);
      runningSum += r[col] as number;
      runningCount++;
      byDate.set(date, { sum: runningSum, count: runningCount });
    }
    const cumulativeReturns = [...byDate.entries()].map(([date, { sum, count }]) => ({
      date,
      cumReturn: sum / count,
      tradeCount: count,
    }));

    return NextResponse.json(
      {
        totalTracked: records.length,
        signalsWithReturns: withReturn.length,
        winRate,
        avgReturn,
        earlyWinRate,
        earlyAvgReturn,
        earlyCount: earlyRecords.length,
        cumulativeReturns,
      },
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
    );
  } catch (err) {
    return handleApiError(err, "stats/performance");
  }
}
