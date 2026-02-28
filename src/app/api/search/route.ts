import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

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

  return NextResponse.json({ results });
}
