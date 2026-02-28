import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const VALID_STAGES = new Set(["EARLY", "FORMING", "CONFIRMED", "FILTERED"]);

export async function GET(request: NextRequest) {
  try {
    const scanId = request.nextUrl.searchParams.get("scanId");
    const stage = request.nextUrl.searchParams.get("stage");

    if (!scanId) {
      return NextResponse.json({ error: "scanId is required" }, { status: 400 });
    }

    if (stage && !VALID_STAGES.has(stage)) {
      return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
    }

    // If stage filter, get symbols from ValidatedTicker first
    let symbolFilter: string[] | undefined;
    if (stage) {
      const tickers = await prisma.validatedTicker.findMany({
        where: { scanId, stage: stage as Prisma.EnumTickerStageFilter["equals"] },
        select: { symbol: true },
      });
      symbolFilter = tickers.map((t) => t.symbol);
    }

    const where: Prisma.SignalWhereInput = {
      scanId,
      ...(symbolFilter ? { symbol: { in: symbolFilter } } : {}),
    };

    // Build a sourceCount lookup from ValidatedTicker for this scan
    const tickers = await prisma.validatedTicker.findMany({
      where: { scanId },
      select: { symbol: true, sourceCount: true },
    });
    const sourceCountMap = new Map(tickers.map((t) => [t.symbol, t.sourceCount]));

    const signals = await prisma.signal.findMany({
      where,
      orderBy: { velocityScore: "desc" },
      take: 200,
    });

    // Sort by sourceCount desc, then velocityScore desc
    signals.sort((a, b) => {
      const scA = sourceCountMap.get(a.symbol) ?? 0;
      const scB = sourceCountMap.get(b.symbol) ?? 0;
      if (scB !== scA) return scB - scA;
      return b.velocityScore - a.velocityScore;
    });

    return NextResponse.json({ signals });
  } catch (err) {
    console.error("[/api/signals] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
