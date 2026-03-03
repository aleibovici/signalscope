import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const VALID_DAYS = new Set([1, 3, 7, 30]);

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 7;

    if (!Number.isInteger(days) || !VALID_DAYS.has(days)) {
      return NextResponse.json(
        { error: "Invalid days parameter. Valid values: 1, 3, 7, 30" },
        { status: 400 }
      );
    }

    const returnCol = `return${days}d` as "return1d" | "return3d" | "return7d" | "return30d";
    const priceCol = `price${days}d` as "price1d" | "price3d" | "price7d" | "price30d";

    // Fetch performance records, limited to most recent 1000 to avoid unbounded queries
    const records = await prisma.tickerPerformance.findMany({
      where: { [returnCol]: { not: null } },
      include: {
        validatedTicker: {
          select: {
            aiScore: true,
            stage: true,
            signalType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    if (records.length === 0) {
      return NextResponse.json({
        overall: { count: 0, winRate: 0, avgReturn: 0 },
        byStage: {},
        byType: {},
        byScoreRange: {},
        bestPerformers: [],
        worstPerformers: [],
      });
    }

    // Helper to compute stats for a subset
    function computeStats(subset: typeof records) {
      const returns = subset.map((r) => r[returnCol] as number);
      const count = returns.length;
      const wins = returns.filter((r) => r > 0).length;
      const avgReturn = returns.reduce((a, b) => a + b, 0) / count;
      return { count, winRate: count > 0 ? wins / count : 0, avgReturn };
    }

    // Overall
    const overall = computeStats(records);

    // By stage
    const byStage: Record<string, ReturnType<typeof computeStats>> = {};
    const stageGroups = new Map<string, typeof records>();
    for (const r of records) {
      const stage = r.validatedTicker.stage;
      if (!stageGroups.has(stage)) stageGroups.set(stage, []);
      stageGroups.get(stage)!.push(r);
    }
    for (const [stage, group] of stageGroups) {
      byStage[stage] = computeStats(group);
    }

    // By signal type
    const byType: Record<string, ReturnType<typeof computeStats>> = {};
    const typeGroups = new Map<string, typeof records>();
    for (const r of records) {
      const type = r.validatedTicker.signalType ?? "unknown";
      if (!typeGroups.has(type)) typeGroups.set(type, []);
      typeGroups.get(type)!.push(r);
    }
    for (const [type, group] of typeGroups) {
      byType[type] = computeStats(group);
    }

    // By score range
    const byScoreRange: Record<string, ReturnType<typeof computeStats>> = {};
    const rangeGroups = new Map<string, typeof records>();
    const ranges = [
      { label: "0-30", min: 0, max: 30 },
      { label: "30-50", min: 30, max: 50 },
      { label: "50-70", min: 50, max: 70 },
      { label: "70-100", min: 70, max: 101 },
    ];
    for (const r of records) {
      const score = r.validatedTicker.aiScore;
      for (const range of ranges) {
        if (score >= range.min && score < range.max) {
          if (!rangeGroups.has(range.label)) rangeGroups.set(range.label, []);
          rangeGroups.get(range.label)!.push(r);
          break;
        }
      }
    }
    for (const [label, group] of rangeGroups) {
      byScoreRange[label] = computeStats(group);
    }

    // Best/Worst performers — deduplicate by symbol, keeping best return per symbol
    const bySymbol = new Map<string, (typeof records)[0]>();
    for (const r of records) {
      const existing = bySymbol.get(r.symbol);
      if (!existing || (r[returnCol] as number) > (existing[returnCol] as number)) {
        bySymbol.set(r.symbol, r);
      }
    }
    const deduped = [...bySymbol.values()].sort(
      (a, b) => (b[returnCol] as number) - (a[returnCol] as number)
    );

    const mapPerformer = (r: (typeof records)[0]) => ({
      symbol: r.symbol,
      return: r[returnCol] as number,
      aiScore: r.validatedTicker.aiScore,
      stage: r.validatedTicker.stage,
      detectionPrice: r.detectionPrice,
      currentPrice: r[priceCol] as number,
    });

    const bestPerformers = deduped.slice(0, 5).map(mapPerformer);
    const worstPerformers = deduped.slice(-5).reverse().map(mapPerformer);

    return NextResponse.json({
      overall,
      byStage,
      byType,
      byScoreRange,
      bestPerformers,
      worstPerformers,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[/api/performance] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
