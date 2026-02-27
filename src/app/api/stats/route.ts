import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, scans, signalRows, tickerGroups, costAgg] = await Promise.all([
    prisma.user.count(),
    prisma.scan.count({ where: { status: "COMPLETED" } }),
    prisma.$queryRaw<[{ count: bigint }]>`
      WITH gaps AS (
        SELECT
          symbol,
          "createdAt",
          LAG("createdAt") OVER (PARTITION BY symbol ORDER BY "createdAt") AS prev_date
        FROM "Signal"
      )
      SELECT COUNT(*)::bigint AS count
      FROM gaps
      WHERE prev_date IS NULL
         OR "createdAt" - prev_date > INTERVAL '30 days'
    `,
    prisma.validatedTicker.groupBy({ by: ["symbol"] }),
    prisma.scan.aggregate({ _sum: { aiCost: true } }),
  ]);

  return NextResponse.json({
    users,
    scans,
    signals: Number(signalRows[0].count),
    tickers: tickerGroups.length,
    totalAiCost: costAgg._sum.aiCost ?? 0,
  });
}
