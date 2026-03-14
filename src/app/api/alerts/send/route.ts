import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTickerAlerts } from "@/lib/email";

export async function POST() {
  // Find the most recent completed scan
  const scan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  if (!scan) {
    return NextResponse.json({ status: "skip", reason: "no completed scan" });
  }

  const MAX_TICKERS = 15;

  // Get all validated tickers (EARLY, FORMING, CONFIRMED) sorted by score
  const allTickers = await prisma.validatedTicker.findMany({
    where: {
      scanId: scan.id,
      stage: { in: ["CONFIRMED", "FORMING", "EARLY"] },
    },
    select: {
      symbol: true,
      price: true,
      aiScore: true,
      catalyst: true,
      signalType: true,
      stage: true,
    },
    orderBy: { opportunityScore: "desc" },
  });

  // Prioritize Emerging (EARLY) signals — highest alpha potential — then Building, then Consensus
  const early = allTickers.filter((t) => t.stage === "EARLY");
  const forming = allTickers.filter((t) => t.stage === "FORMING");
  const confirmed = allTickers.filter((t) => t.stage === "CONFIRMED");
  const tickers = [...early, ...forming, ...confirmed].slice(0, MAX_TICKERS);

  await sendTickerAlerts(
    tickers.map((t) => ({
      symbol: t.symbol,
      price: t.price,
      aiScore: t.aiScore,
      catalyst: t.catalyst,
      signalType: t.signalType,
      stage: t.stage,
    })),
    allTickers.length
  );

  return NextResponse.json({
    status: "sent",
    scanId: scan.id,
    tickerCount: tickers.length,
    totalAvailable: allTickers.length,
  });
}
