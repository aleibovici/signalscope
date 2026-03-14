import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReport } from "@/lib/harvester/report";
import { reconstructAggregatedSymbol } from "@/lib/reconstruct-aggregated";
import type { SignalType, TradeSetup } from "@/lib/harvester/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    await getCurrentUserId();
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

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

    const tickerReport = await generateTickerReport(
      upperSymbol,
      agg,
      fundamentals,
      ticker.aiScore,
      (ticker.signalType as SignalType) ?? undefined,
      novelty
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
  } catch (err) {
    return handleApiError(err, "POST /api/tickers/[symbol]/report");
  }
}
