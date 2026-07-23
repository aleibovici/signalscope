import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (isRateLimited(`search:${ip}`, 60_000, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase() ?? "";
    if (q.length < 1) return NextResponse.json({ results: [] });
    if (q.length > 20) return NextResponse.json({ error: "Query too long" }, { status: 400 });

    // Latest ValidatedTicker per matching symbol (carries score/stage)
    const tickers = await prisma.validatedTicker.findMany({
      where: { symbol: { contains: q, mode: "insensitive" } },
      distinct: ["symbol"],
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { symbol: true, aiScore: true, opportunityScore: true, stage: true, price: true },
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
        opportunityScore: t.opportunityScore,
        stage: t.stage,
        price: t.price,
      })),
      ...signals.map((s) => ({
        symbol: s.symbol,
        aiScore: null,
        opportunityScore: null,
        stage: null,
        price: null,
      })),
    ];

    return NextResponse.json({ results }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (err) {
    console.error("[/api/search] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
