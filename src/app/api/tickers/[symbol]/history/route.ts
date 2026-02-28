import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    const records = await prisma.validatedTicker.findMany({
      where: { symbol: upperSymbol, scan: { status: "COMPLETED" } },
      include: { scan: { select: { startedAt: true } } },
      orderBy: { scan: { startedAt: "asc" } },
    });

    const history = records.map((r) => ({
      scanId: r.scanId,
      startedAt: r.scan.startedAt.toISOString(),
      aiScore: r.aiScore,
      stage: r.stage,
      price: r.price,
      signalCount: r.signalCount,
      sourceCount: r.sourceCount,
      recommendation: r.recommendation,
    }));

    return NextResponse.json({ history });
  } catch (err) {
    console.error("[/api/tickers/[symbol]/history] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
