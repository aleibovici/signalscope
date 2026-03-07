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
    const upper = symbol.toUpperCase();

    const performances = await prisma.tickerPerformance.findMany({
      where: { symbol: upper },
      include: {
        validatedTicker: {
          select: {
            createdAt: true,
            aiScore: true,
            stage: true,
            scanId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (performances.length === 0) {
      return NextResponse.json({ latest: null, history: [] });
    }

    return NextResponse.json({
      latest: performances[0],
      history: performances,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]/performance");
  }
}
