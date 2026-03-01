import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;

    const [scan, tickers, signals] = await Promise.all([
      prisma.scan.findUnique({ where: { id: scanId } }),
      prisma.validatedTicker.findMany({
        where: { 
          scanId,
          stage: { not: "FILTERED" }
        },
        orderBy: { aiScore: "desc" },
        include: {
          performance: { select: { return7d: true } },
        },
      }),
      prisma.signal.findMany({
        where: { scanId },
        select: { symbol: true, source: true },
      }),
    ]);

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const sourcesBySymbol = new Map<string, Set<string>>();
    for (const s of signals) {
      let set = sourcesBySymbol.get(s.symbol);
      if (!set) {
        set = new Set<string>();
        sourcesBySymbol.set(s.symbol, set);
      }
      set.add(s.source);
    }

    const tickersWithSources = tickers.map((t) => ({
      ...t,
      return7d: t.performance?.return7d ?? null,
      performance: undefined,
      sources: [...(sourcesBySymbol.get(t.symbol) ?? [])],
    }));

    return NextResponse.json({ scan, tickers: tickersWithSources });
  } catch (err) {
    console.error("[/api/scans/[scanId]] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
