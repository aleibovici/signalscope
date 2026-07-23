import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { tweetTickerBatch, selectDiversifiedTickers, type TickerDetail } from "@/lib/twitter/post";
import { ACTIONABLE_MARKET_CAP_MAX } from "@/lib/harvester/recommendation";

/**
 * POST /api/tweets/post
 *
 * Tweets emerging tickers (EARLY/FORMING with reports) as a self-thread: first ticker is
 * a standalone tweet, subsequent tickers chain as self-replies to build a single thread.
 * Auth: x-snapshot-key header (same as reports/snapshots).
 * Intended to run after /api/reports/generate completes.
 */
export async function POST(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }
    if (!snapshotKey || snapshotKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the most recent completed scan
    const latestScan = await prisma.scan.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });

    if (!latestScan) {
      return NextResponse.json({ status: "no_scan", posted: [], failed: [] });
    }

    // Get top tickers that already have reports (catalyst != null)
    const tickers = await prisma.validatedTicker.findMany({
      where: {
        scanId: latestScan.id,
        stage: { in: ["EARLY", "FORMING"] },
        catalyst: { not: null },
        recommendation: { not: null, notIn: ["Avoid"] },
        OR: [
          { marketCap: null },
          { marketCap: { lte: ACTIONABLE_MARKET_CAP_MAX } },
        ],
      },
      orderBy: { opportunityScore: "desc" },
      take: 30, // fetch more so diversified selection has enough per tier
    });

    if (tickers.length === 0) {
      console.log("[tweets/post] No emerging tickers with reports to tweet");
      return NextResponse.json({ status: "no_tickers", posted: [], failed: [] });
    }

    const details: TickerDetail[] = tickers.map((t) => ({
      symbol: t.symbol,
      recommendation: t.recommendation ?? "Watch",
      catalyst: t.catalyst ?? "",
      risks: t.risks ?? "",
      aiReasoning: t.aiReasoning,
      stage: t.stage,
      opportunityScore: t.opportunityScore,
      aiScore: t.aiScore,
      price: t.price ? Number(t.price) : null,
      marketCap: t.marketCap ? Number(t.marketCap) : null,
      sector: t.sector,
      sourceCount: t.sourceCount,
    }));

    const diversified = selectDiversifiedTickers(details, 5);
    const result = await tweetTickerBatch(diversified);

    return NextResponse.json({
      status: result.posted.length > 0 || result.replies.length > 0 ? "tweeted" : "failed",
      posted: result.posted,
      failed: result.failed,
      replies: result.replies,
      replyFailed: result.replyFailed,
    });
  } catch (err) {
    return handleApiError(err, "tweets/post");
  }
}
