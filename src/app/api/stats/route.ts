import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    await getCurrentUserId();

    const [scans, signals, tickerGroups, trackedTickers, perfAgg, wins, users] =
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
        prisma.user.count(),
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
      users,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[/api/stats] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
