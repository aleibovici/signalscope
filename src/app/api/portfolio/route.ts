import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { addPositionSchema } from "@/lib/validators";
import { fetchCurrentPrices } from "@/lib/harvester/fundamentals";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const positions = await prisma.userPosition.findMany({
      where: { userId },
      orderBy: { openedAt: "desc" },
    });

    // Batch-fetch current prices for all unique open symbols
    const openSymbols = [
      ...new Set(positions.filter((p) => p.status === "OPEN").map((p) => p.symbol)),
    ];

    const priceMap = await fetchCurrentPrices(openSymbols);

    const enriched = positions.map((p) => {
      const currentPrice = p.status === "OPEN" ? priceMap.get(p.symbol) ?? null : p.closePrice;
      const gainPct =
        currentPrice != null
          ? ((currentPrice - p.entryPrice) / p.entryPrice) * 100
          : null;

      return { ...p, currentPrice, gainPct };
    });

    return NextResponse.json({ positions: enriched });
  } catch (error) {
    return handleApiError(error, "/api/portfolio GET");
  }
}

export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    return handleApiError(error, "/api/portfolio POST");
  }
}
