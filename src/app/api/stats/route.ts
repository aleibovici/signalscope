import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await getCurrentUserId();
    // Dedup TickerPerformance by symbol (keep earliest detection per symbol)
    // and exclude phantom Yahoo Finance prices (<= $0.01)
    const [scans, signals, tickerCount, perfStats, users] =
      await Promise.all([
        prisma.scan.count({ where: { status: "COMPLETED" } }),
        prisma.scan.aggregate({
          _sum: { signalCount: true },
          where: { status: "COMPLETED" },
        }).then((r) => r._sum.signalCount ?? 0),
        prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT symbol) as count FROM "ValidatedTicker"`.then(
          (rows) => Number(rows[0].count)
        ),
        prisma.$queryRaw<[{ tracked: bigint; wins: bigint; avg_return: number | null }]>`
          SELECT
            COUNT(*) as tracked,
            COUNT(*) FILTER (WHERE "return7d" > 0) as wins,
            AVG("return7d") as avg_return
          FROM (
            SELECT DISTINCT ON (symbol) symbol, "return7d"
            FROM "TickerPerformance"
            WHERE "return7d" IS NOT NULL AND "detectionPrice" > 0.01
            ORDER BY symbol, "createdAt"
          ) deduped
        `.then((rows) => rows[0]),
        prisma.user.count(),
      ]);

    const trackedTickers = Number(perfStats.tracked);
    const wins = Number(perfStats.wins);
    const avgReturn7d = perfStats.avg_return ?? 0;
    const winRate7d = trackedTickers > 0 ? wins / trackedTickers : 0;

    return NextResponse.json({
      scans,
      signals,
      tickers: tickerCount,
      avgReturn7d,
      winRate7d,
      trackedTickers,
      users,
    });
  } catch (err) {
    return handleApiError(err, "/api/stats GET");
  }
}
