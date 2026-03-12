import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { generateTickerReport } from "@/lib/harvester/report";
import type { RawSignal, AggregatedSymbol, FundamentalData, SignalType, NoveltyContext } from "@/lib/harvester/types";

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

    // If report already exists, return it
    if (ticker.catalyst && ticker.risks && ticker.report) {
      return NextResponse.json({
        catalyst: ticker.catalyst,
        risks: ticker.risks,
        recommendation: ticker.recommendation,
        report: ticker.report,
      });
    }

    // Fetch signals for this ticker's scan to reconstruct AggregatedSymbol
    const signals = await prisma.signal.findMany({
      where: { scanId: ticker.scanId, symbol: upperSymbol },
    });

    if (signals.length === 0) {
      return NextResponse.json(
        { error: "No signals found for report generation" },
        { status: 404 }
      );
    }

    // Reconstruct RawSignal[] from DB signals
    const rawSignals: RawSignal[] = signals.map((s) => ({
      symbol: s.symbol,
      source: s.source as RawSignal["source"],
      title: s.title ?? undefined,
      body: s.body ?? undefined,
      url: s.url ?? undefined,
      author: s.author ?? undefined,
      authorAge: s.authorAge ?? undefined,
      authorKarma: s.authorKarma ?? undefined,
      upvotes: s.upvotes ?? undefined,
      commentCount: s.commentCount ?? undefined,
      subreddit: s.subreddit ?? undefined,
      postAge: s.postAge ?? undefined,
      sortType: s.sortType ?? undefined,
      purchaseValue: s.purchaseValue ?? undefined,
      insiderTitle: s.insiderTitle ?? undefined,
      volumeRatio: s.volumeRatio ?? undefined,
      followerCount: s.followerCount ?? undefined,
      retweetCount: s.retweetCount ?? undefined,
      likeCount: s.likeCount ?? undefined,
      tweetType: s.tweetType ?? undefined,
    }));

    // Reconstruct AggregatedSymbol from DB fields
    const agg: AggregatedSymbol = {
      symbol: upperSymbol,
      signals: rawSignals,
      sourceCount: ticker.sourceCount,
      weightedSourceScore: ticker.weightedSourceScore ?? 0,
      subredditCount: ticker.subredditCount ?? 0,
      totalUpvotes: ticker.totalUpvotes ?? 0,
      totalComments: ticker.totalComments ?? 0,
      avgVelocity: ticker.avgVelocity ?? 0,
      momentum: {
        risingCount: ticker.risingCount ?? 0,
        freshCount: ticker.freshCount ?? 0,
        recentCount: ticker.recentCount ?? 0,
        commentDerivedCount: ticker.commentDerivedCount ?? 0,
        staleCount: ticker.staleCount ?? 0,
      },
      medianSignalAgeHrs: null,
    };

    // Reconstruct FundamentalData from DB fields
    const fundamentals: FundamentalData | null =
      ticker.price != null
        ? {
            price: ticker.price,
            marketCap: ticker.marketCap,
            shortFloat: ticker.shortFloat,
            fiftyTwoWeekRange: ticker.fiftyTwoWkRange ?? undefined,
            wk52Lo: ticker.wk52Lo,
            wk52Hi: ticker.wk52Hi,
            name: ticker.name ?? undefined,
            sector: ticker.sector ?? undefined,
            exchange: ticker.exchange ?? undefined,
          }
        : null;

    // Reconstruct novelty context
    const novelty: NoveltyContext | undefined =
      ticker.firstSeenDaysAgo !== null || ticker.priorAppearances > 0
        ? {
            firstSeenAt: null,
            daysSinceFirstSeen: ticker.firstSeenDaysAgo,
            priorAppearances: ticker.priorAppearances,
            isNovel: ticker.firstSeenDaysAgo === null,
          }
        : undefined;

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
      },
    });

    return NextResponse.json(tickerReport);
  } catch (err) {
    return handleApiError(err, "POST /api/tickers/[symbol]/report");
  }
}
