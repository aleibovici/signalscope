import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTickerAlerts } from "@/lib/email";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReportReACT } from "@/lib/harvester/report";
import { reconstructAggregatedSymbol } from "@/lib/reconstruct-aggregated";
import type { SignalType } from "@/lib/harvester/types";

export async function POST(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      console.error("[alerts/send] SNAPSHOT_API_KEY not configured");
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }

    if (!snapshotKey || snapshotKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the most recent completed scan
    const scan = await prisma.scan.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    if (!scan) {
      return NextResponse.json({ status: "skip", reason: "no completed scan" });
    }

    // Stage priority for the digest: Emerging (EARLY) → Building (FORMING) → Consensus (CONFIRMED).
    // Within each stage, same tie-break as the dashboard: aiScore desc, then opportunityScore desc.
    const STAGE_PRIORITY: Record<string, number> = { EARLY: 0, FORMING: 1, CONFIRMED: 2 };

    // Fetch full ticker rows — needed for both report generation and email
    const allCandidates = await prisma.validatedTicker.findMany({
      where: {
        scanId: scan.id,
        aiScore: { gte: 50 },
        pndFlagged: false,
        stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
      },
    });

    const topTickers = allCandidates
      .sort((a, b) => {
        const stageDiff = (STAGE_PRIORITY[a.stage] ?? 9) - (STAGE_PRIORITY[b.stage] ?? 9);
        if (stageDiff !== 0) return stageDiff;
        const scoreDiff = b.aiScore - a.aiScore;
        if (scoreDiff !== 0) return scoreDiff;
        return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
      })
      .slice(0, 6);

    console.log(`[alerts/send] Top candidates: ${topTickers.length} (of ${allCandidates.length})`);

    // Pre-generate full AI reports for email tickers that don't have one yet.
    // This ensures click-throughs from the email always land on a page with a report.
    const reportsGenerated: string[] = [];
    for (const ticker of topTickers) {
      if (ticker.catalyst) continue; // already has a report
      try {
        const { agg, fundamentals, novelty } = await reconstructAggregatedSymbol(ticker);
        const tickerReport = await generateTickerReportReACT(
          ticker.symbol,
          agg,
          fundamentals,
          ticker.aiScore,
          ticker.scanId,
          (ticker.signalType as SignalType) ?? undefined,
          novelty,
          { trigger: "batch-report", scanId: ticker.scanId, symbol: ticker.symbol },
          ticker.stage,
          ticker.pndFlagged ?? false,
        );
        await prisma.validatedTicker.update({
          where: { id: ticker.id },
          data: {
            catalyst: tickerReport.catalyst,
            risks: tickerReport.risks,
            recommendation: tickerReport.recommendation,
            report: tickerReport.report,
            tradeSetupEntryLo: tickerReport.tradeSetup?.entryLo ?? null,
            tradeSetupEntryHi: tickerReport.tradeSetup?.entryHi ?? null,
            tradeSetupStopLoss: tickerReport.tradeSetup?.stopLoss ?? null,
            tradeSetupTarget1: tickerReport.tradeSetup?.target1 ?? null,
            tradeSetupTarget2: tickerReport.tradeSetup?.target2 ?? null,
            tradeSetupTimeframe: tickerReport.tradeSetup?.timeframe ?? null,
            tradeSetupRiskReward: tickerReport.tradeSetup?.riskReward ?? null,
            tradeSetupConfidence: tickerReport.tradeSetup?.confidence ?? null,
          },
        });
        // Reflect in the ticker object so the email uses the populated catalyst
        ticker.catalyst = tickerReport.catalyst;
        reportsGenerated.push(ticker.symbol);
        console.log(`[alerts/send] ✓ report generated for ${ticker.symbol}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[alerts/send] ✗ report failed for ${ticker.symbol} — ${msg}`);
      }
    }

    if (reportsGenerated.length > 0) {
      console.log(`[alerts/send] Pre-generated reports: ${reportsGenerated.join(", ")}`);
    }

    // Total available (for email footer context) — all non-filtered validated tickers in this scan
    const totalAvailable = await prisma.validatedTicker.count({
      where: {
        scanId: scan.id,
        stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
      },
    });

    await sendTickerAlerts(
      topTickers.map((t) => ({
        symbol: t.symbol,
        price: t.price,
        aiScore: t.aiScore,
        aiReasoning: t.aiReasoning,
        catalyst: t.catalyst,
        signalType: t.signalType,
        stage: t.stage,
      })),
      totalAvailable
    );

    return NextResponse.json({
      status: "sent",
      scanId: scan.id,
      tickerCount: topTickers.length,
      reportsGenerated: reportsGenerated.length,
      totalAvailable,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/alerts/send");
  }
}
