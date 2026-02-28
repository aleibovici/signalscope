import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    const ticker = await prisma.validatedTicker.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { createdAt: "desc" },
      include: {
        performance: { select: { return7d: true } },
      },
    });

    if (!ticker) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }

    const signals = await prisma.signal.findMany({
      where: { scanId: ticker.scanId, symbol: upperSymbol },
      orderBy: { createdAt: "desc" },
    });

    // Compute sources and return7d to match ValidatedTickerData interface
    const sources = [...new Set(signals.map((s) => s.source))];

    return NextResponse.json({
      ticker: {
        ...ticker,
        return7d: ticker.performance?.return7d ?? null,
        performance: undefined,
        sources,
      },
      signals,
    });
  } catch (err) {
    console.error("[/api/tickers/[symbol]] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
