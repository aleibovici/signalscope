import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, scans, signals, tickerGroups, trackedTickers, perfAgg, wins] =
    await Promise.all([
      prisma.user.count(),
      prisma.scan.count({ where: { status: "COMPLETED" } }),
      prisma.signal.count(),
      prisma.validatedTicker.groupBy({ by: ["symbol"] }),
      prisma.tickerPerformance.count({ where: { return7d: { not: null } } }),
      prisma.tickerPerformance.aggregate({
        _avg: { return7d: true },
        where: { return7d: { not: null } },
      }),
      prisma.tickerPerformance.count({ where: { return7d: { gt: 0 } } }),
    ]);

  const avgReturn7d = perfAgg._avg.return7d ?? 0;
  const winRate7d = trackedTickers > 0 ? wins / trackedTickers : 0;

  return NextResponse.json({
    users,
    scans,
    signals,
    tickers: tickerGroups.length,
    avgReturn7d,
    winRate7d,
    trackedTickers,
  });
}
