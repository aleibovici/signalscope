import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const tickers = await prisma.validatedTicker.findMany({
    where: { scanId },
    orderBy: { aiScore: "desc" },
  });

  // Fetch distinct sources per symbol for this scan
  const signals = await prisma.signal.findMany({
    where: { scanId },
    select: { symbol: true, source: true },
  });

  const sourcesBySymbol = new Map<string, string[]>();
  for (const s of signals) {
    const sources = sourcesBySymbol.get(s.symbol);
    if (sources) {
      if (!sources.includes(s.source)) sources.push(s.source);
    } else {
      sourcesBySymbol.set(s.symbol, [s.source]);
    }
  }

  const tickersWithSources = tickers.map((t) => ({
    ...t,
    sources: sourcesBySymbol.get(t.symbol) ?? [],
  }));

  return NextResponse.json({ scan, tickers: tickersWithSources });
}
