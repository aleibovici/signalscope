import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { collectSnapshots } from "@/lib/snapshots";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      console.error("[snapshots/collect] SNAPSHOT_API_KEY not configured");
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }

    const bufKey = snapshotKey ? Buffer.from(snapshotKey, "utf8") : null;
    const bufExpected = Buffer.from(expectedKey, "utf8");
    const keyMatch =
      bufKey !== null &&
      bufKey.byteLength === bufExpected.byteLength &&
      timingSafeEqual(bufKey, bufExpected);
    if (!keyMatch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[snapshots/collect] Starting snapshot collection...");
    const t0 = Date.now();
    const stats = await collectSnapshots();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`[snapshots/collect] Completed in ${elapsed}s — ${stats.filled} filled, ${stats.errors} errors, ${stats.skipped} skipped`);

    return NextResponse.json({ status: "completed", ...stats });
  } catch (err) {
    return handleApiError(err, "snapshots/collect");
  }
}
