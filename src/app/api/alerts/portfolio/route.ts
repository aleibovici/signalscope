import { NextRequest, NextResponse } from "next/server";
import { sendPortfolioAlerts } from "@/lib/email";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      console.error("[alerts/portfolio] SNAPSHOT_API_KEY not configured");
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }

    if (!snapshotKey || snapshotKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { usersNotified, tickersMatched } = await sendPortfolioAlerts();

    return NextResponse.json({
      status: usersNotified > 0 ? "sent" : "skip",
      usersNotified,
      tickersMatched,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/alerts/portfolio");
  }
}
