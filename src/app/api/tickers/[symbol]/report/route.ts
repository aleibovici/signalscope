import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReportReACT } from "@/lib/harvester/report";
import { reconstructAggregatedSymbol } from "@/lib/reconstruct-aggregated";
import type { SignalType, TradeSetup } from "@/lib/harvester/types";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";
import { hasActiveSubscription } from "@/lib/subscription";

async function handleReport(request: NextRequest, upperSymbol: string, userId?: string) {
  const ticker = await prisma.validatedTicker.findFirst({
    where: { symbol: upperSymbol },
    orderBy: { createdAt: "desc" },
  });

  if (!ticker) {
    return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
  }

  // If report already exists, return it (re-generate for Buy/Strong Buy tickers missing trade setup)
  const isBuyRec = ticker.recommendation === "Buy" || ticker.recommendation === "Strong Buy";
  if (ticker.catalyst && ticker.risks && ticker.report && !(isBuyRec && ticker.tradeSetupEntryLo == null)) {
    const tradeSetup: TradeSetup | undefined =
      ticker.tradeSetupEntryLo != null
        ? {
            entryLo: ticker.tradeSetupEntryLo,
            entryHi: ticker.tradeSetupEntryHi!,
            stopLoss: ticker.tradeSetupStopLoss!,
            target1: ticker.tradeSetupTarget1!,
            target2: ticker.tradeSetupTarget2!,
            timeframe: ticker.tradeSetupTimeframe!,
            riskReward: ticker.tradeSetupRiskReward!,
            confidence: ticker.tradeSetupConfidence as TradeSetup["confidence"],
          }
        : undefined;
    return NextResponse.json({
      catalyst: ticker.catalyst,
      risks: ticker.risks,
      recommendation: ticker.recommendation,
      report: ticker.report,
      ...(tradeSetup ? { tradeSetup } : {}),
    });
  }

  const { agg, fundamentals, novelty, signals } = await reconstructAggregatedSymbol(ticker);

  if (signals.length === 0) {
    return NextResponse.json(
      { error: "No signals found for report generation" },
      { status: 404 }
    );
  }

  const tickerReport = await generateTickerReportReACT(
    upperSymbol,
    agg,
    fundamentals,
    ticker.aiScore,
    ticker.scanId,
    (ticker.signalType as SignalType) ?? undefined,
    novelty,
    { trigger: "on-demand", symbol: upperSymbol, userId },
    ticker.stage,
  );

  // Persist the report to the DB
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

  return NextResponse.json(tickerReport);
}

// x402 payment-wrapped handler — extracts symbol from URL path
const x402ReportHandler = X402_ENABLED
  ? withX402Logged(
      (async (request: NextRequest) => {
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        // /api/tickers/AAPL/report → ["", "api", "tickers", "AAPL", "report"]
        const symbol = pathParts[3]?.toUpperCase();
        if (!symbol) {
          return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }
        return handleReport(request, symbol);
      }) as (request: NextRequest) => Promise<NextResponse<unknown>>,
      x402RouteConfigs.report,
      "report",
    )
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    // Authenticated users — normal path (API key still blocked for report generation)
    if (hasAuthCredentials(request)) {
      if (request.headers.get("x-api-key")) {
        return NextResponse.json({ error: "Not available via API key" }, { status: 403 });
      }
      const userId = await getCurrentUserId();

      // Check if report already exists — free users can view existing reports
      const existing = await prisma.validatedTicker.findFirst({
        where: { symbol: upperSymbol },
        orderBy: { createdAt: "desc" },
        select: { catalyst: true, report: true },
      });
      const hasReport = existing?.catalyst && existing?.report;

      // On-demand generation requires Pro subscription
      if (!hasReport && !(await hasActiveSubscription(userId))) {
        return NextResponse.json(
          { error: "Generating AI reports requires a Pro subscription. Visit /subscription to upgrade." },
          { status: 403 }
        );
      }

      return await handleReport(request, upperSymbol, userId);
    }

    // x402 payment present — validate payment (AI agent flow)
    if (request.headers.has("x-payment") && x402ReportHandler) {
      return x402ReportHandler(request);
    }

    // Anonymous access — serve cached report only, don't generate
    const existing = await prisma.validatedTicker.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { createdAt: "desc" },
      select: { catalyst: true, risks: true, recommendation: true, report: true, tradeSetupEntryLo: true, tradeSetupEntryHi: true, tradeSetupStopLoss: true, tradeSetupTarget1: true, tradeSetupTarget2: true, tradeSetupTimeframe: true, tradeSetupRiskReward: true, tradeSetupConfidence: true },
    });
    if (existing?.catalyst && existing?.report) {
      const tradeSetup = existing.tradeSetupEntryLo != null ? {
        entryLo: existing.tradeSetupEntryLo,
        entryHi: existing.tradeSetupEntryHi!,
        stopLoss: existing.tradeSetupStopLoss!,
        target1: existing.tradeSetupTarget1!,
        target2: existing.tradeSetupTarget2!,
        timeframe: existing.tradeSetupTimeframe!,
        riskReward: existing.tradeSetupRiskReward!,
        confidence: existing.tradeSetupConfidence as "low" | "medium" | "high",
      } : undefined;
      return NextResponse.json({
        catalyst: existing.catalyst,
        risks: existing.risks,
        recommendation: existing.recommendation,
        report: existing.report,
        ...(tradeSetup ? { tradeSetup } : {}),
      });
    }
    return NextResponse.json(
      { error: "Sign in to generate AI reports for this ticker" },
      { status: 403 },
    );
  } catch (err) {
    return handleApiError(err, "POST /api/tickers/[symbol]/report");
  }
}
