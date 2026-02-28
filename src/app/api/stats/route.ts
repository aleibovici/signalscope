import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, scans, signals, tickerGroups, costAgg] = await Promise.all([
    prisma.user.count(),
    prisma.scan.count({ where: { status: "COMPLETED" } }),
    prisma.signal.count(),
    prisma.validatedTicker.groupBy({ by: ["symbol"] }),
    prisma.scan.aggregate({ _sum: { aiCost: true } }),
  ]);

  return NextResponse.json({
    users,
    scans,
    signals,
    tickers: tickerGroups.length,
    totalAiCost: costAgg._sum.aiCost ?? 0,
  });
}
