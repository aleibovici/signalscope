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
      performance: {
        select: {
          return1d: true,
          return3d: true,
          return7d: true,
          return14d: true,
          return30d: true,
        },
      },
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

  const perf = ticker.performance;
  return NextResponse.json({
    ticker: {
      ...ticker,
      stage: stageLabel(ticker.stage),
      return1d: perf?.return1d ?? null,
      return3d: perf?.return3d ?? null,
      return7d: perf?.return7d ?? null,
      return14d: perf?.return14d ?? null,
      return30d: perf?.return30d ?? null,
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

    if (request.headers.has("x-payment") && x402Handler) {
      return x402Handler(request);
    }

    return await handleTicker(request, upperSymbol);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]");
  }
}
