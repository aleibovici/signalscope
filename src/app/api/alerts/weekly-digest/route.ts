import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { sendWeeklyDigest } from "@/lib/email/weekly-digest";

/**
 * POST /api/alerts/weekly-digest
 *
 * Sends a free weekly email digest to ALL users with emailAlerts=true.
 * Shows top 3 tickers + recent winners. Free users get an upgrade CTA,
 * subscribers get a dashboard link.
 *
 * Auth: x-snapshot-key header.
 * Schedule: Sundays 10 AM ET via Cloud Scheduler.
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

    const result = await sendWeeklyDigest();

    return NextResponse.json({
      status: result.sent > 0 ? "sent" : "skipped",
      ...result,
    });
  } catch (err) {
    return handleApiError(err, "alerts/weekly-digest");
  }
}
