import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
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
}
