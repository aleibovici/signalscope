import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await getCurrentUserId();

    return NextResponse.json(
      { error: "Leaderboard is temporarily disabled" },
      { status: 503 }
    );
  } catch (err) {
    return handleApiError(err, "/api/leaderboard");
  }
}
