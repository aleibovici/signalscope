import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";
import { stageLabel } from "@/lib/stage-labels";

async function handleHistory(request: NextRequest, upperSymbol: string) {
  const records = await prisma.validatedTicker.findMany({
    where: { symbol: upperSymbol, scan: { status: "COMPLETED" } },
    include: { scan: { select: { startedAt: true } } },
    orderBy: { scan: { startedAt: "asc" } },
  });

  const history = records.map((r) => ({
    scanId: r.scanId,
    startedAt: r.scan.startedAt.toISOString(),
    aiScore: r.aiScore,
    stage: stageLabel(r.stage),
    price: r.price,
    signalCount: r.signalCount,
    sourceCount: r.sourceCount,
    recommendation: r.recommendation,
  }));

  return NextResponse.json({ history });
}

const x402Handler = X402_ENABLED
  ? withX402Logged(
      (async (request: NextRequest) => {
        const url = new URL(request.url);
        const symbol = url.pathname.split("/")[3]?.toUpperCase();
        if (!symbol) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        return handleHistory(request, symbol);
      }) as (request: NextRequest) => Promise<NextResponse<unknown>>,
      x402RouteConfigs.history,
      "history",
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
      return await handleHistory(request, upperSymbol);
    }

    if (x402Handler) {
      return x402Handler(request);
    }

    await getCurrentUserId();
    return await handleHistory(request, upperSymbol);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]/history");
  }
}
