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

  // Get all validated tickers (CONFIRMED, FORMING, EARLY) sorted by score
  const tickers = await prisma.validatedTicker.findMany({
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
    orderBy: { aiScore: "desc" },
  });

  await sendTickerAlerts(
    tickers.map((t) => ({
      symbol: t.symbol,
      price: t.price,
      aiScore: t.aiScore,
      catalyst: t.catalyst,
      signalType: t.signalType,
      stage: t.stage,
    }))
  );

  return NextResponse.json({
    status: "sent",
    scanId: scan.id,
    tickerCount: tickers.length,
  });
}
