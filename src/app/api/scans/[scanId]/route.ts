import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stageLabel } from "@/lib/stage-labels";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    await getOptionalUserId();
    const { scanId } = await params;
    const includeFiltered = request.nextUrl.searchParams.get("includeFiltered") === "true";

    const [scan, tickers, signals] = await Promise.all([
      prisma.scan.findUnique({ where: { id: scanId } }),
      prisma.validatedTicker.findMany({
        where: {
          scanId,
          ...(includeFiltered ? {} : { stage: { notIn: ["FILTERED", "UNSCORED"] } }),
        },
        orderBy: [{ aiScore: "desc" }, { opportunityScore: "desc" }],
        select: {
          id: true,
          scanId: true,
          symbol: true,
          name: true,
          price: true,
          marketCap: true,
          shortFloat: true,
          recommendation: true,
          aiScore: true,
          opportunityScore: true,
          stage: true,
          signalCount: true,
          sourceCount: true,
          avgSentiment: true,
          signalType: true,
          fiftyTwoWkRange: true,
          wk52Lo: true,
          wk52Hi: true,
          exchange: true,
          firstSeenDaysAgo: true,
          priorAppearances: true,
          weightedSourceScore: true,
          avgVelocity: true,
          totalUpvotes: true,
          totalComments: true,
          subredditCount: true,
          risingCount: true,
          freshCount: true,
          recentCount: true,
          commentDerivedCount: true,
          staleCount: true,
          sector: true,
          floatShares: true,
          pndFlagged: true,
          pndFlags: true,
          pndScore: true,
          rawAiScore: true,
          pndAiConfidence: true,
          medianSignalAgeHrs: true,
          catalyst: true,
          risks: true,
          report: true,
          tradeSetupEntryLo: true,
          tradeSetupEntryHi: true,
          tradeSetupStopLoss: true,
          tradeSetupTarget1: true,
          tradeSetupTarget2: true,
          tradeSetupTimeframe: true,
          tradeSetupRiskReward: true,
          tradeSetupConfidence: true,
          createdAt: true,
          performance: { select: { return7d: true } },
        },
      }),
      prisma.signal.findMany({
        where: { scanId },
        select: { symbol: true, source: true },
        distinct: ["symbol", "source"],
      }),
    ]);

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const sourcesBySymbol = new Map<string, Set<string>>();
    for (const s of signals) {
      let set = sourcesBySymbol.get(s.symbol);
      if (!set) {
        set = new Set<string>();
        sourcesBySymbol.set(s.symbol, set);
      }
      set.add(s.source);
    }

    const tickersWithSources = tickers.map((t) => ({
      ...t,
      stage: stageLabel(t.stage),
      return7d: t.performance?.return7d ?? null,
      performance: undefined,
      sources: [...(sourcesBySymbol.get(t.symbol) ?? [])],
    }));

    return NextResponse.json({ scan, tickers: tickersWithSources });
  } catch (err) {
    return handleApiError(err, "GET /api/scans/[scanId]");
  }
}
