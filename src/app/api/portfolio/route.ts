import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { addPositionSchema } from "@/lib/validators";
import { fetchCurrentPrices } from "@/lib/harvester/fundamentals";

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
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/portfolio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("POST /api/portfolio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
