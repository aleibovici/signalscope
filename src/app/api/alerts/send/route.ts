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

  // High-conviction EARLY signals only — mirrors the manual analyst filter:
  // AI score >= 50, not P&D flagged, novel (firstSeenDaysAgo <= 3 or truly new),
  // low prior appearances, has an identified catalyst. Quality over quantity (max 6).
  const tickers = await prisma.validatedTicker.findMany({
    where: {
      scanId: scan.id,
      stage: "EARLY",
      aiScore: { gte: 50 },
      pndFlagged: false,
      pndScore: { lte: 1 },
      priorAppearances: { lte: 5 },
      catalyst: { not: null },
      OR: [
        { firstSeenDaysAgo: null },
        { firstSeenDaysAgo: { lte: 3 } },
      ],
    },
    select: {
      symbol: true,
      price: true,
      aiScore: true,
      catalyst: true,
      signalType: true,
      stage: true,
    },
    orderBy: [{ aiScore: "desc" }, { opportunityScore: "desc" }],
    take: 6,
  });

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
