import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReportReACT } from "@/lib/harvester/report";
import { reconstructAggregatedSymbol } from "@/lib/reconstruct-aggregated";
import { tweetTickerBatch, selectDiversifiedTickers, type TickerDetail } from "@/lib/twitter/post";
import type { SignalType } from "@/lib/harvester/types";

const BATCH_SIZE = 10;

export async function POST(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      console.error("[reports/generate] SNAPSHOT_API_KEY not configured");
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }

    if (!snapshotKey || snapshotKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[reports/generate] Starting batch report generation...");
    const t0 = Date.now();

    // Find the most recent completed scan
    const latestScan = await prisma.scan.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });

    if (!latestScan) {
      return NextResponse.json({ status: "no_scan", generated: 0, skipped: 0, errors: [] });
    }

    // Find top tickers by opportunityScore that are missing reports
    const tickers = await prisma.validatedTicker.findMany({
      where: {
        scanId: latestScan.id,
        stage: { in: ["EARLY", "FORMING"] },
        catalyst: null, // no report yet
      },
      orderBy: { opportunityScore: "desc" },
      take: BATCH_SIZE,
    });

    if (tickers.length === 0) {
      console.log("[reports/generate] No tickers need reports");
      return NextResponse.json({ status: "completed", scanId: latestScan.id, generated: 0, skipped: 0, errors: [] });
    }

    console.log(`[reports/generate] Generating reports for ${tickers.length} tickers: ${tickers.map((t) => t.symbol).join(", ")}`);

    let generated = 0;
    let skipped = 0;
    const errors: { symbol: string; error: string }[] = [];
    const tweetCandidates: TickerDetail[] = [];

    for (const ticker of tickers) {
      try {
        const { agg, fundamentals, novelty, signals } = await reconstructAggregatedSymbol(ticker);

        if (signals.length === 0) {
          console.warn(`[reports/generate] No signals for ${ticker.symbol}, skipping`);
          skipped++;
          continue;
        }

        const tickerReport = await generateTickerReportReACT(
          ticker.symbol,
          agg,
          fundamentals,
          ticker.aiScore,
          ticker.scanId,
          (ticker.signalType as SignalType) ?? undefined,
          novelty
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

        console.log(`[reports/generate] ✓ ${ticker.symbol} — ${tickerReport.recommendation}`);
        generated++;

        // Collect tickers for tweeting (exclude Avoid, top 5 by opportunityScore)
        if (tickerReport.recommendation !== "Avoid") {
          tweetCandidates.push({
          symbol: ticker.symbol,
          recommendation: tickerReport.recommendation,
          catalyst: tickerReport.catalyst,
          risks: tickerReport.risks,
          aiReasoning: ticker.aiReasoning,
          stage: ticker.stage,
          opportunityScore: ticker.opportunityScore,
          aiScore: ticker.aiScore,
          price: ticker.price ? Number(ticker.price) : null,
          marketCap: ticker.marketCap ? Number(ticker.marketCap) : null,
          sector: ticker.sector,
          sourceCount: ticker.sourceCount,
        });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[reports/generate] ✗ ${ticker.symbol} — ${msg}`);
        errors.push({ symbol: ticker.symbol, error: msg });
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[reports/generate] Completed in ${elapsed}s — ${generated} generated, ${skipped} skipped, ${errors.length} errors`);

    // Tweet individual tickers (best-effort, doesn't affect response)
    let tweetResult = null;
    if (tweetCandidates.length > 0) {
      try {
        const diversified = selectDiversifiedTickers(tweetCandidates, 10);
        console.log(`[reports/generate] Tweeting ${diversified.length} tickers: ${diversified.map((t) => t.symbol).join(", ")}`);
        const result = await tweetTickerBatch(diversified);
        tweetResult = { posted: result.posted, failed: result.failed };
        if (result.failed.length > 0) {
          console.warn(`[reports/generate] Tweet failures: ${result.failed.map((f) => `${f.symbol}: ${f.error}`).join(", ")}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[reports/generate] Tweet error (non-fatal): ${msg}`);
        tweetResult = { posted: [], failed: [{ symbol: "batch", error: msg }] };
      }
    }

    return NextResponse.json({
      status: "completed",
      scanId: latestScan.id,
      generated,
      skipped,
      errors,
      tweet: tweetResult,
    });
  } catch (err) {
    return handleApiError(err, "reports/generate");
  }
}
