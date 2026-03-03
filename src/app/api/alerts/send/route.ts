import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConfirmedTickerAlerts } from "@/lib/email";

export async function POST() {
  // Find the most recent completed scan
  const scan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  if (!scan) {
    return NextResponse.json({ status: "skip", reason: "no completed scan" });
  }

  // Guard against double-sends: only send if scan completed within the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (!scan.completedAt || scan.completedAt < oneHourAgo) {
    return NextResponse.json({
      status: "skip",
      reason: "scan too old",
      scanId: scan.id,
      completedAt: scan.completedAt,
    });
  }

  // Get confirmed tickers from this scan
  const tickers = await prisma.validatedTicker.findMany({
    where: { scanId: scan.id, stage: "CONFIRMED" },
    select: {
      symbol: true,
      price: true,
      aiScore: true,
      catalyst: true,
      signalType: true,
    },
  });

  await sendConfirmedTickerAlerts(
    tickers.map((t) => ({
      symbol: t.symbol,
      price: t.price,
      aiScore: t.aiScore,
      catalyst: t.catalyst,
      signalType: t.signalType,
    }))
  );

  return NextResponse.json({
    status: "sent",
    scanId: scan.id,
    tickerCount: tickers.length,
  });
}
