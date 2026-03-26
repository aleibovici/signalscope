import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (isRateLimited(`stats:${ip}`, 60_000, 20)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    await getOptionalUserId();
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
