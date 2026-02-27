import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { addPositionSchema } from "@/lib/validators";
import { fetchCurrentPrice } from "@/lib/harvester/fundamentals";

export async function GET() {
  const userId = await getCurrentUserId();

  const positions = await prisma.userPosition.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
  });

  // Fetch current prices for open positions
  const openSymbols = [
    ...new Set(positions.filter((p) => p.status === "OPEN").map((p) => p.symbol)),
  ];

  const priceMap = new Map<string, number | null>();
  await Promise.all(
    openSymbols.map(async (symbol) => {
      const price = await fetchCurrentPrice(symbol);
      priceMap.set(symbol, price);
    })
  );

  const enriched = positions.map((p) => {
    const currentPrice = p.status === "OPEN" ? priceMap.get(p.symbol) ?? null : p.closePrice;
    const gainPct =
      currentPrice != null
        ? ((currentPrice - p.entryPrice) / p.entryPrice) * 100
        : null;

    return { ...p, currentPrice, gainPct };
  });

  return NextResponse.json({ positions: enriched });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await request.json();
  const data = addPositionSchema.parse(body);

  const position = await prisma.userPosition.create({
    data: {
      userId,
      symbol: data.symbol,
      entryPrice: data.entryPrice,
      shares: data.shares,
      notes: data.notes,
    },
  });

  return NextResponse.json({ position }, { status: 201 });
}
