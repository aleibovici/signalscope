import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [scans, signals, tickerGroups, trackedTickers, perfAgg, wins] =
      await Promise.all([
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
      scans,
      signals,
      tickers: tickerGroups.length,
      avgReturn7d,
      winRate7d,
      trackedTickers,
    });
  } catch (err) {
    console.error("[/api/stats] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
