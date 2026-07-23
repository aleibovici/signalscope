import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { addWatchlistSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const watchlist = await prisma.userWatchlist.findMany({
      where: { userId },
      select: { symbol: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ watchlist });
  } catch (error) {
    return handleApiError(error, "/api/watchlist GET");
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const { symbol } = addWatchlistSchema.parse(body);

    await prisma.userWatchlist.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol },
      update: {},
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "/api/watchlist POST");
  }
}
