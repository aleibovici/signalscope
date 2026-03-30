import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTickerAlerts } from "@/lib/email";

export async function POST(req: NextRequest) {
  const snapshotKey = req.headers.get("x-snapshot-key");
  const expectedKey = process.env.SNAPSHOT_API_KEY;

  if (!expectedKey) {
    console.error("[alerts/send] SNAPSHOT_API_KEY not configured");
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
  }

  if (!snapshotKey || snapshotKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the most recent completed scan
  const scan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  if (!scan) {
    return NextResponse.json({ status: "skip", reason: "no completed scan" });
  }

  // Novel high-conviction signals: AI score >= 50, not P&D, first seen <= 3 days.
  // Try EARLY first (emerging before consensus); fall back to FORMING if none qualify.
  const alertSelect = {
    symbol: true,
    price: true,
    aiScore: true,
    catalyst: true,
    signalType: true,
    stage: true,
  } as const;

  const alertWhere = {
    scanId: scan.id,
    aiScore: { gte: 50 },
    pndFlagged: false,
    OR: [
      { firstSeenDaysAgo: null },
      { firstSeenDaysAgo: { lte: 3 } },
    ],
  };

  const alertOrderBy = [
    { aiScore: "desc" as const },
    { opportunityScore: "desc" as const },
  ];

  let tickers = await prisma.validatedTicker.findMany({
    where: { ...alertWhere, stage: "EARLY" },
    select: alertSelect,
    orderBy: alertOrderBy,
    take: 6,
  });

  console.log(`[alerts/send] EARLY candidates: ${tickers.length}`);

  if (tickers.length === 0) {
    tickers = await prisma.validatedTicker.findMany({
      where: { ...alertWhere, stage: "FORMING" },
      select: alertSelect,
      orderBy: alertOrderBy,
      take: 6,
    });
    console.log(`[alerts/send] FORMING fallback: ${tickers.length}`);
  }

  // Total available (for email footer context) — all non-filtered validated tickers in this scan
  const totalAvailable = await prisma.validatedTicker.count({
    where: {
      scanId: scan.id,
      stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
    },
  });

  await sendTickerAlerts(
    tickers.map((t) => ({
      symbol: t.symbol,
      price: t.price,
      aiScore: t.aiScore,
      catalyst: t.catalyst,
      signalType: t.signalType,
      stage: t.stage,
    })),
    totalAvailable
  );

  return NextResponse.json({
    status: "sent",
    scanId: scan.id,
    tickerCount: tickers.length,
    totalAvailable,
  });
}
