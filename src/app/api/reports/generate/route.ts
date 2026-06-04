import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReportReACT } from "@/lib/harvester/report";
import { reconstructAggregatedSymbol } from "@/lib/reconstruct-aggregated";
import type { SignalType } from "@/lib/harvester/types";
import { executeForTickers } from "@/lib/brokers/executor";
import { ACTIONABLE_MARKET_CAP_MAX } from "@/lib/harvester/recommendation";

// FORMING tickers first (Buy/Strong Buy eligible), then EARLY — prevents high-scoring
// single-source EARLY tickers (insider/congress with sourceCount=1) from crowding out
// FORMING multi-source tickers that are the only realistic path to a Buy recommendation.
const EARLY_FORMING_BATCH_SIZE = 10;
// CONFIRMED tickers qualify for Buy C (score>=60 + fresh) but are excluded from the
// EARLY/FORMING batch query. Process them separately so Buy C recommendations are generated.
const CONFIRMED_BATCH_SIZE = 5;

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

    // EARLY/FORMING batch: FORMING sorted first (F > E desc) so multi-source Building tickers
    // are not displaced by high-scoring single-source Emerging tickers.
    const actionableCapFilter = {
      OR: [
        { marketCap: null },
        { marketCap: { lte: ACTIONABLE_MARKET_CAP_MAX } },
      ],
    } as const;

    const earlyFormingTickers = await prisma.validatedTicker.findMany({
      where: {
        scanId: latestScan.id,
        stage: { in: ["EARLY", "FORMING"] },
        ...actionableCapFilter,
        catalyst: null,
      },
      orderBy: [{ stage: "desc" }, { opportunityScore: "desc" }, { aiScore: "desc" }],
      take: EARLY_FORMING_BATCH_SIZE,
    });

    // CONFIRMED batch: separate pass so Buy C candidates (score>=60 + fresh) are not skipped.
    const confirmedTickers = await prisma.validatedTicker.findMany({
      where: {
        scanId: latestScan.id,
        stage: "CONFIRMED",
        ...actionableCapFilter,
        catalyst: null,
      },
      orderBy: [{ opportunityScore: "desc" }, { aiScore: "desc" }],
      take: CONFIRMED_BATCH_SIZE,
    });

    const tickers = [...earlyFormingTickers, ...confirmedTickers];

    if (tickers.length === 0) {
      console.log("[reports/generate] No tickers need reports");
      return NextResponse.json({ status: "completed", scanId: latestScan.id, generated: 0, skipped: 0, errors: [] });
    }

    console.log(`[reports/generate] Generating reports for ${tickers.length} tickers: ${tickers.map((t) => t.symbol).join(", ")} (${earlyFormingTickers.length} EARLY/FORMING, ${confirmedTickers.length} CONFIRMED)`);

    let generated = 0;
    let skipped = 0;
    const errors: { symbol: string; error: string }[] = [];
    // Tweeting is handled by the separate POST /api/tweets/post endpoint
    // (avoids duplicate tweets when both run on the same schedule)

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

        console.log(`[reports/generate] ✓ ${ticker.symbol} — ${tickerReport.recommendation}`);
        generated++;

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[reports/generate] ✗ ${ticker.symbol} — ${msg}`);
        errors.push({ symbol: ticker.symbol, error: msg });
      }
    }

    // After report generation, execute trade setups on IBKR paper account (if configured)
    let brokerResults: { symbol: string; status: string; reason?: string }[] = [];
    if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
      try {
        // Re-fetch actionable Buy/Strong Buy tickers from the scan.
        // Stage/cap guards protect rows labeled before the current recommendation rule.
        const updatedTickers = await prisma.validatedTicker.findMany({
          where: {
            scanId: latestScan.id,
            recommendation: { in: ["Buy", "Strong Buy"] },
            stage: { in: ["EARLY", "FORMING"] },
            OR: [
              { marketCap: null },
              { marketCap: { lte: ACTIONABLE_MARKET_CAP_MAX } },
            ],
          },
          orderBy: { opportunityScore: "desc" },
        });
        brokerResults = await executeForTickers(updatedTickers);
        console.log(`[reports/generate] IBKR paper execution: ${JSON.stringify(
          brokerResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>)
        )}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[reports/generate] IBKR paper execution failed: ${msg}`);
        brokerResults = [{ symbol: "_global", status: "error", reason: msg }];
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[reports/generate] Completed in ${elapsed}s — ${generated} generated, ${skipped} skipped, ${errors.length} errors`);

    return NextResponse.json({
      status: "completed",
      scanId: latestScan.id,
      generated,
      skipped,
      errors,
      broker: brokerResults,
    });
  } catch (err) {
    return handleApiError(err, "reports/generate");
  }
}
