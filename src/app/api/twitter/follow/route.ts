import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { runFollowJob } from "@/lib/twitter/follow";

/**
 * POST /api/twitter/follow
 *
 * Automated Twitter follow/unfollow job. Per run:
 * - Seeds curated finance accounts into queue (idempotent)
 * - Discovers new accounts from recent harvest Twitter signals
 * - Follows next 5 from queue (X rate limit: 5/15min)
 * - Unfollows 3 stale accounts (30+ days, no follow-back, not keep)
 * - Updates follow-back flags from our followers list
 *
 * Schedule every 30 min 9AM–6:30PM ET (20x/day) for ~100 follows/day.
 * Auth: x-snapshot-key header (same as the other scheduled-job endpoints).
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

    const result = await runFollowJob();

    return NextResponse.json({
      status: "ok",
      ...result,
    });
  } catch (err) {
    return handleApiError(err, "twitter/follow");
  }
}
