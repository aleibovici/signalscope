import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  const ticker = await prisma.validatedTicker.findFirst({
    where: { symbol: upperSymbol },
    orderBy: { createdAt: "desc" },
  });

  if (!ticker) {
    return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
  }

  const signals = await prisma.signal.findMany({
    where: { scanId: ticker.scanId, symbol: upperSymbol },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ticker, signals });
}
