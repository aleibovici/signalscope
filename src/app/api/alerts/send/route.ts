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

  // Stage priority for the digest: Emerging (EARLY) → Building (FORMING) → Consensus (CONFIRMED).
  // Within each stage, same tie-break as the dashboard: aiScore desc, then opportunityScore desc.
  const STAGE_PRIORITY: Record<string, number> = { EARLY: 0, FORMING: 1, CONFIRMED: 2 };

  const allCandidates = await prisma.validatedTicker.findMany({
    where: {
      scanId: scan.id,
      aiScore: { gte: 50 },
      pndFlagged: false,
      stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
    },
    select: {
      symbol: true,
      price: true,
      aiScore: true,
      aiReasoning: true,
      catalyst: true,
      signalType: true,
      stage: true,
      opportunityScore: true,
    },
  });

  const tickers = allCandidates
    .sort((a, b) => {
      const stageDiff = (STAGE_PRIORITY[a.stage] ?? 9) - (STAGE_PRIORITY[b.stage] ?? 9);
      if (stageDiff !== 0) return stageDiff;
      const scoreDiff = b.aiScore - a.aiScore;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    })
    .slice(0, 6);

  console.log(`[alerts/send] Top candidates: ${tickers.length} (of ${allCandidates.length})`);

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
      aiReasoning: t.aiReasoning,
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
