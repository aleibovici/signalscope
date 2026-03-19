import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";

async function handlePerformance(request: NextRequest, upper: string) {
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

const x402Handler = X402_ENABLED
  ? withX402Logged(
      (async (request: NextRequest) => {
        const url = new URL(request.url);
        const symbol = url.pathname.split("/")[3]?.toUpperCase();
        if (!symbol) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        return handlePerformance(request, symbol);
      }) as (request: NextRequest) => Promise<NextResponse<unknown>>,
      x402RouteConfigs.performance,
      "performance",
    )
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (hasAuthCredentials(request)) {
      await getCurrentUserId();
      return await handlePerformance(request, upper);
    }

    if (x402Handler) {
      return x402Handler(request);
    }

    await getCurrentUserId();
    return await handlePerformance(request, upper);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]/performance");
  }
}
