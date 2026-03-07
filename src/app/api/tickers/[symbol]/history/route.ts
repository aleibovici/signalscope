import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    await getCurrentUserId();
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
    return handleApiError(err, "GET /api/tickers/[symbol]/history");
  }
}
