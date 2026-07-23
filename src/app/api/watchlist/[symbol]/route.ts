import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { symbolSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawSymbol } = await params;
    const symbol = symbolSchema.parse(rawSymbol);
    const userId = await getCurrentUserId();

    const result = await prisma.userWatchlist.deleteMany({
      where: { userId, symbol },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Watchlist entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "/api/watchlist/[symbol] DELETE");
  }
}
