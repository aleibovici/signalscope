import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";
import { changelog } from "@/lib/changelog-data";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (isRateLimited(`changelog:${ip}`, 60_000, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    return NextResponse.json(
      { entries: changelog },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (err) {
    return handleApiError(err, "GET /api/changelog");
  }
}
