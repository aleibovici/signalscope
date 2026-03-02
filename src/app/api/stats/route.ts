import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await getCurrentUserId();
    const [scans, signals, tickerCount, trackedTickers, perfAgg, wins, users] =
      await Promise.all([
        prisma.scan.count({ where: { status: "COMPLETED" } }),
        prisma.scan.aggregate({
          _sum: { signalCount: true },
          where: { status: "COMPLETED" },
        }).then((r) => r._sum.signalCount ?? 0),
        prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT symbol) as count FROM "ValidatedTicker"`.then(
          (rows) => Number(rows[0].count)
        ),
        prisma.tickerPerformance.count({ where: { return7d: { not: null } } }),
        prisma.tickerPerformance.aggregate({
          _avg: { return7d: true },
          where: { return7d: { not: null } },
        }),
        prisma.tickerPerformance.count({ where: { return7d: { gt: 0 } } }),
        prisma.user.count(),
      ]);

    const avgReturn7d = perfAgg._avg.return7d ?? 0;
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
