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
    const [records, totalTracked] = await Promise.all([
      prisma.tickerPerformance.findMany({
        where: {
          detectionPrice: { gt: 0.01 },
          corporateActionDetected: false,
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
      }),
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT symbol) as count FROM "ValidatedTicker"`.then(
        (rows) => Number(rows[0].count)
      ),
    ]);

    const col: ReturnCol = "return7d";
    const withReturn = records.filter((r) => r[col] !== null);

    if (withReturn.length === 0) {
      return NextResponse.json(
        { totalTracked, winRate: 0, avgReturn: 0, emergingWinRate: 0, emergingAvgReturn: 0, cumulativeReturns: [] },
        { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
      );
    }

    // Overall stats
    const returns = withReturn.map((r) => r[col] as number);
    const wins = returns.filter((r) => r > 0).length;
    const winRate = wins / returns.length;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Emerging-stage stats (EARLY only)
    const emergingRecords = withReturn.filter((r) => r.validatedTicker.stage === "EARLY");
    const emergingReturns = emergingRecords.map((r) => r[col] as number);
    const emergingWins = emergingReturns.filter((r) => r > 0).length;
    const emergingWinRate = emergingReturns.length > 0 ? emergingWins / emergingReturns.length : 0;

    // 7-day rolling avg return by detection date — emerging signals only
    const earlyWithReturn = withReturn.filter((r) => r.validatedTicker.stage === "EARLY");
    const byDateMap = new Map<string, { sum: number; count: number; wins: number }>();
    for (const r of earlyWithReturn) {
      const date = r.validatedTicker.createdAt.toISOString().slice(0, 10);
      if (!byDateMap.has(date)) byDateMap.set(date, { sum: 0, count: 0, wins: 0 });
      const entry = byDateMap.get(date)!;
      entry.sum += r[col] as number;
      entry.count += 1;
      if ((r[col] as number) > 0) entry.wins += 1;
    }
    const sortedDates = [...byDateMap.keys()].sort();
    const cumulativeReturns = sortedDates.map((date) => {
      const dateMs = new Date(date + "T00:00:00Z").getTime();
      const sevenDaysAgoMs = dateMs - 6 * 24 * 60 * 60 * 1000;
      let sum = 0;
      let count = 0;
      let wins = 0;
      for (const d of sortedDates) {
        const dMs = new Date(d + "T00:00:00Z").getTime();
        if (dMs >= sevenDaysAgoMs && dMs <= dateMs) {
          sum += byDateMap.get(d)!.sum;
          count += byDateMap.get(d)!.count;
          wins += byDateMap.get(d)!.wins;
        }
      }
      return { date, cumReturn: count > 0 ? sum / count : 0, tradeCount: count, winCount: wins };
    });

    const recentWindow = cumulativeReturns.slice(-7);
    const recentTotal = recentWindow.reduce((s, p) => s + p.tradeCount, 0);
    const emergingAvgReturn = recentTotal > 0
      ? recentWindow.reduce((s, p) => s + p.cumReturn * p.tradeCount, 0) / recentTotal
      : 0;

    return NextResponse.json(
      {
        totalTracked,
        signalsWithReturns: withReturn.length,
        winRate,
        avgReturn,
        emergingWinRate,
        emergingAvgReturn,
        emergingCount: emergingRecords.length,
        cumulativeReturns,
      },
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
    );
  } catch (err) {
    return handleApiError(err, "stats/performance");
  }
}
