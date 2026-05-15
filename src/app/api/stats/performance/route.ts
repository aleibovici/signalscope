import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

/**
 * Public endpoint — returns aggregate performance stats for the landing page.
 * Matches the filter on /results/paper-trading (AI score ≥ 70, post scoring
 * overhaul, last 30 days of detections). No auth required. Cached for 10 min.
 */

type ReturnCol = "return1d" | "return3d" | "return7d" | "return30d";

const AI_SCORE_THRESHOLD = 70;
const SCORING_CUTOFF = new Date("2026-03-16T00:00:00Z");

export async function GET() {
  try {
    const [records, totalTracked] = await Promise.all([
      prisma.tickerPerformance.findMany({
        where: {
          detectionPrice: { gt: 0.01 },
          corporateActionDetected: false,
          validatedTicker: {
            aiScore: { gte: AI_SCORE_THRESHOLD },
            stage: { notIn: ["FILTERED", "UNSCORED"] },
            createdAt: { gte: SCORING_CUTOFF },
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
        { totalTracked, signalsWithReturns: 0, winRate: 0, avgReturn: 0, emergingWinRate: 0, emergingAvgReturn: 0, emergingCount: 0, cumulativeReturns: [] },
        { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
      );
    }

    // Overall stats (high-confidence cohort, post scoring overhaul)
    const returns = withReturn.map((r) => r[col] as number);
    const wins = returns.filter((r) => r > 0).length;
    const winRate = wins / returns.length;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // "Current window" stats — last 30 days of detections (matches /results page)
    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const currentRecords = withReturn.filter(
      (r) => r.validatedTicker.createdAt.getTime() >= thirtyDaysAgoMs,
    );
    const currentReturns = currentRecords.map((r) => r[col] as number);
    const currentWins = currentReturns.filter((r) => r > 0).length;
    const emergingWinRate = currentReturns.length > 0 ? currentWins / currentReturns.length : 0;

    // 7-day rolling avg return by detection date — current-window signals
    const byDateMap = new Map<string, { sum: number; count: number; wins: number }>();
    for (const r of currentRecords) {
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

    const emergingAvgReturn = currentReturns.length > 0
      ? currentReturns.reduce((a, b) => a + b, 0) / currentReturns.length
      : 0;

    return NextResponse.json(
      {
        totalTracked,
        signalsWithReturns: withReturn.length,
        winRate,
        avgReturn,
        emergingWinRate,
        emergingAvgReturn,
        emergingCount: currentRecords.length,
        cumulativeReturns,
      },
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
    );
  } catch (err) {
    return handleApiError(err, "stats/performance");
  }
}
