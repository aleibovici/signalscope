import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { generateAndPostPromoTweet, type PromoStats } from "@/lib/twitter/promo";

/**
 * POST /api/tweets/promo
 *
 * Generates and posts a single promotional tweet about a SignalScope feature.
 * Called 3x/day by Cloud Scheduler with different slot values (0, 1, 2).
 *
 * Body: { "slot": 0 | 1 | 2 }  (optional — defaults to 0)
 * Auth: x-snapshot-key header.
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

    // Parse slot from body (default 0)
    let slot = 0;
    try {
      const body = await req.json();
      if (typeof body.slot === "number" && [0, 1, 2].includes(body.slot)) {
        slot = body.slot;
      }
    } catch {
      // No body or invalid JSON — use default slot 0
    }

    // Fetch platform stats + latest scan details + trending cashtags
    const [scanCount, tickerCount, latestScan] = await Promise.all([
      prisma.scan.count({ where: { status: "COMPLETED" } }),
      prisma.validatedTicker.count(),
      prisma.scan.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    const stats: PromoStats = {
      totalScans: scanCount,
      totalTickers: tickerCount,
    };

    if (latestScan) {
      // Latest scan stage breakdown + signal count
      const [stageCounts, signalCount, distinctSources] = await Promise.all([
        prisma.validatedTicker.groupBy({
          by: ["stage"],
          where: { scanId: latestScan.id, stage: { in: ["EARLY", "FORMING", "CONFIRMED"] } },
          _count: true,
        }),
        prisma.signal.count({ where: { scanId: latestScan.id } }),
        prisma.signal.groupBy({
          by: ["source"],
          where: { scanId: latestScan.id },
        }),
      ]);

      stats.latestSignalCount = signalCount;
      stats.latestSourceCount = distinctSources.length;

      for (const row of stageCounts) {
        if (row.stage === "EARLY") stats.latestEarlyCount = row._count;
        if (row.stage === "FORMING") stats.latestFormingCount = row._count;
        if (row.stage === "CONFIRMED") stats.latestConfirmedCount = row._count;
      }

      // Top trending cashtags: highest opportunity score tickers from latest scan
      // that have a recommendation of Buy/Strong Buy/Watch (not Avoid)
      const topTickers = await prisma.validatedTicker.findMany({
        where: {
          scanId: latestScan.id,
          stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
          recommendation: { notIn: ["Avoid"] },
        },
        orderBy: { opportunityScore: "desc" },
        take: 5,
        select: { symbol: true },
      });

      stats.trendingSymbols = topTickers.map((t) => t.symbol);
    }

    const result = await generateAndPostPromoTweet(slot, stats);

    return NextResponse.json({
      status: result.postResult.success ? "tweeted" : "failed",
      topic: result.topic,
      tweet: result.tweet,
      url: result.url,
      tweetId: result.postResult.tweetId,
      error: result.postResult.error,
    });
  } catch (err) {
    return handleApiError(err, "tweets/promo");
  }
}
