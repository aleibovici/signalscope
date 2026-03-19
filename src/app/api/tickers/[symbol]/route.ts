import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";
import { stageLabel } from "@/lib/stage-labels";

async function handleTicker(request: NextRequest, upperSymbol: string) {
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

  const sources = [...new Set(signals.map((s) => s.source))];

  return NextResponse.json({
    ticker: {
      ...ticker,
      stage: stageLabel(ticker.stage),
      return7d: ticker.performance?.return7d ?? null,
      performance: undefined,
      sources,
    },
    signals,
  });
}

const x402Handler = X402_ENABLED
  ? withX402Logged(
      (async (request: NextRequest) => {
        const url = new URL(request.url);
        const symbol = url.pathname.split("/")[3]?.toUpperCase();
        if (!symbol) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        return handleTicker(request, symbol);
      }) as (request: NextRequest) => Promise<NextResponse<unknown>>,
      x402RouteConfigs.ticker,
      "ticker",
    )
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    if (hasAuthCredentials(request)) {
      await getCurrentUserId();
      return await handleTicker(request, upperSymbol);
    }

    if (x402Handler) {
      return x402Handler(request);
    }

    await getCurrentUserId();
    return await handleTicker(request, upperSymbol);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]");
  }
}
