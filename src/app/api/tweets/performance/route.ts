import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { tweetPerformanceBatch } from "@/lib/twitter/performance";

/**
 * POST /api/tweets/performance
 *
 * Tweets a performance summary thread: top performers flagged by SignalScope
 * with actual return data ("$XYZ +23% in 7 days"). Builds trust by showing
 * proof of past successful calls.
 *
 * Auth: x-snapshot-key header.
 * Schedule: Once daily via your scheduler (e.g. 10 AM ET Mon-Fri).
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

    const result = await tweetPerformanceBatch();

    return NextResponse.json({
      status: result.summary.success ? "tweeted" : "failed",
      summary: {
        tweetId: result.summary.tweetId,
        error: result.summary.error,
      },
      details: result.details.map((d) => ({
        symbol: d.symbol,
        tweetId: d.result.tweetId,
        error: d.result.error,
      })),
      performers: result.hits.map((h) => ({
        symbol: h.symbol,
        returnPct: h.returnPct,
        period: h.period,
      })),
    });
  } catch (err) {
    return handleApiError(err, "tweets/performance");
  }
}
