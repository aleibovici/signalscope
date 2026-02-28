import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
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
}
