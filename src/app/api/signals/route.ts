import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";
import { stageToDb } from "@/lib/stage-labels";

const VALID_STAGES = new Set(["EARLY", "FORMING", "CONFIRMED", "FILTERED", "Emerging", "Building", "Consensus", "Filtered"]);

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const scanId = request.nextUrl.searchParams.get("scanId");
    const stage = request.nextUrl.searchParams.get("stage");

    if (!scanId) {
      return NextResponse.json({ error: "scanId is required" }, { status: 400 });
    }

    if (stage && !VALID_STAGES.has(stage)) {
      return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
    }

    const dbStage = stage ? stageToDb(stage) : undefined;

    // Single query for both stage filtering and sourceCount lookup
    const tickers = await prisma.validatedTicker.findMany({
      where: { scanId },
      select: { symbol: true, sourceCount: true, stage: true },
    });
    const sourceCountMap = new Map(tickers.map((t) => [t.symbol, t.sourceCount]));

    const symbolFilter = dbStage
      ? tickers.filter((t) => t.stage === dbStage).map((t) => t.symbol)
      : undefined;

    const where: Prisma.SignalWhereInput = {
      scanId,
      ...(symbolFilter ? { symbol: { in: symbolFilter } } : {}),
    };

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
    return handleApiError(err, "GET /api/signals");
  }
}
