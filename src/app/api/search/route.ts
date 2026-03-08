import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase() ?? "";
    if (q.length < 1) return NextResponse.json({ results: [] });
    if (q.length > 20) return NextResponse.json({ error: "Query too long" }, { status: 400 });

    // Latest ValidatedTicker per matching symbol (carries score/stage)
    const tickers = await prisma.validatedTicker.findMany({
      where: { symbol: { contains: q, mode: "insensitive" } },
      distinct: ["symbol"],
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { symbol: true, aiScore: true, stage: true, price: true },
    });

    const tickerSymbols = tickers.map((t) => t.symbol);

    // Fill remaining slots from Signal for symbols not already covered
    const remaining = 8 - tickers.length;
    const signals =
      remaining > 0
        ? await prisma.signal.findMany({
            where: {
              symbol: { contains: q, mode: "insensitive" },
              NOT: { symbol: { in: tickerSymbols } },
            },
            distinct: ["symbol"],
            orderBy: { createdAt: "desc" },
            take: remaining,
            select: { symbol: true },
          })
        : [];

    const results = [
      ...tickers.map((t) => ({
        symbol: t.symbol,
        aiScore: t.aiScore,
        stage: t.stage,
        price: t.price,
      })),
      ...signals.map((s) => ({
        symbol: s.symbol,
        aiScore: null,
        stage: null,
        price: null,
      })),
    ];

    return NextResponse.json({ results }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[/api/search] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
