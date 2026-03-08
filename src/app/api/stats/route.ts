import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await getCurrentUserId();
    const [scans, signals, tickerCount] =
      await Promise.all([
        prisma.scan.count({ where: { status: "COMPLETED" } }),
        prisma.scan.aggregate({
          _sum: { signalCount: true },
          where: { status: "COMPLETED" },
        }).then((r) => r._sum.signalCount ?? 0),
        prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT symbol) as count FROM "ValidatedTicker"`.then(
          (rows) => Number(rows[0].count)
        ),
      ]);

    return NextResponse.json({
      scans,
      signals,
      tickers: tickerCount,
    }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return handleApiError(err, "/api/stats GET");
  }
}
