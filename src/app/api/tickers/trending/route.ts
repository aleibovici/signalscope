import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validators";

const trendingSchema = paginationSchema.extend({
  minAppearances: z.coerce.number().int().min(2).default(2),
  stage: z.enum(["EARLY", "FORMING", "CONFIRMED"]).optional(),
  trend: z.enum(["rising", "falling", "stable"]).optional(),
});

function computeTrend(scores: number[]): "rising" | "falling" | "stable" {
  if (scores.length < 2) return "stable";
  const mid = Math.ceil(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const delta = avgSecond - avgFirst;
  if (delta >= 5) return "rising";
  if (delta <= -5) return "falling";
  return "stable";
}

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = trendingSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, minAppearances, stage, trend } = parsed.data;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Find qualifying symbols via raw SQL (groupBy + relation filter on scan.status)
    const qualifyingRows = await prisma.$queryRaw<{ symbol: string; cnt: bigint }[]>`
      SELECT vt.symbol, COUNT(*)::bigint AS cnt
      FROM "ValidatedTicker" vt
      JOIN "Scan" s ON s.id = vt."scanId"
      WHERE vt."createdAt" >= ${thirtyDaysAgo}
        AND s.status = 'COMPLETED'
        AND vt.stage != 'FILTERED'
      GROUP BY vt.symbol
      HAVING COUNT(*) >= ${minAppearances}
    `;

    const qualifyingSymbols = qualifyingRows.map((r) => r.symbol);
    if (qualifyingSymbols.length === 0) {
      return NextResponse.json({
        tickers: [],
        total: 0,
        summary: { totalTrending: 0, risingCount: 0, fallingCount: 0, stableCount: 0, avgScore: 0 },
      });
    }

    const countBySymbol = new Map(qualifyingRows.map((r) => [r.symbol, Number(r.cnt)]));

    // 2. Fetch all appearances for sparkline + trend computation
    const allAppearances = await prisma.validatedTicker.findMany({
      where: {
        symbol: { in: qualifyingSymbols },
        createdAt: { gte: thirtyDaysAgo },
        scan: { status: "COMPLETED" },
        stage: { not: "FILTERED" },
      },
      select: { symbol: true, aiScore: true, stage: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Build trajectory and trend per symbol
    const trajectoryMap = new Map<string, { score: number; stage: string; date: string }[]>();
    for (const a of allAppearances) {
      let arr = trajectoryMap.get(a.symbol);
      if (!arr) {
        arr = [];
        trajectoryMap.set(a.symbol, arr);
      }
      arr.push({
        score: a.aiScore,
        stage: a.stage,
        date: a.createdAt.toISOString().slice(0, 10),
      });
    }

    const trendMap = new Map<string, "rising" | "falling" | "stable">();
    for (const [symbol, trajectory] of trajectoryMap) {
      trendMap.set(symbol, computeTrend(trajectory.map((t) => t.score)));
    }

    // Apply trend filter before pagination
    let filteredSymbols = qualifyingSymbols;
    if (trend) {
      filteredSymbols = filteredSymbols.filter((s) => trendMap.get(s) === trend);
    }

    // 3. Fetch latest full record per symbol
    const latestRecords = await prisma.validatedTicker.findMany({
      where: {
        symbol: { in: filteredSymbols },
        scan: { status: "COMPLETED" },
        stage: stage ? stage : { not: "FILTERED" },
      },
      distinct: ["symbol"],
      orderBy: { createdAt: "desc" },
      include: {
        performance: { select: { return7d: true } },
      },
    });

    // Apply stage filter — only keep symbols that have the latest record matching
    const latestBySymbol = new Map(latestRecords.map((r) => [r.symbol, r]));
    if (stage) {
      filteredSymbols = filteredSymbols.filter((s) => latestBySymbol.has(s));
    }

    // Fetch distinct signal sources for latest scan per symbol
    const latestScanIds = [...new Set(latestRecords.map((r) => r.scanId))];
    const signalSources = await prisma.signal.findMany({
      where: {
        scanId: { in: latestScanIds },
        symbol: { in: filteredSymbols },
      },
      select: { symbol: true, source: true },
      distinct: ["symbol", "source"],
    });

    const sourcesBySymbol = new Map<string, Set<string>>();
    for (const s of signalSources) {
      let set = sourcesBySymbol.get(s.symbol);
      if (!set) {
        set = new Set<string>();
        sourcesBySymbol.set(s.symbol, set);
      }
      set.add(s.source);
    }

    // Build sorted results: appearance count desc, then latest aiScore desc
    const sortedSymbols = filteredSymbols
      .filter((s) => latestBySymbol.has(s))
      .sort((a, b) => {
        const countDiff = (countBySymbol.get(b) ?? 0) - (countBySymbol.get(a) ?? 0);
        if (countDiff !== 0) return countDiff;
        return (latestBySymbol.get(b)!.aiScore) - (latestBySymbol.get(a)!.aiScore);
      });

    // Compute summary before pagination
    let risingCount = 0;
    let fallingCount = 0;
    let stableCount = 0;
    let scoreSum = 0;
    for (const symbol of sortedSymbols) {
      const t = trendMap.get(symbol);
      if (t === "rising") risingCount++;
      else if (t === "falling") fallingCount++;
      else stableCount++;
      scoreSum += latestBySymbol.get(symbol)!.aiScore;
    }

    const total = sortedSymbols.length;
    const avgScore = total > 0 ? Math.round(scoreSum / total) : 0;

    // Paginate
    const start = (page - 1) * limit;
    const pageSymbols = sortedSymbols.slice(start, start + limit);

    const tickers = pageSymbols.map((symbol) => {
      const record = latestBySymbol.get(symbol)!;
      return {
        id: record.id,
        symbol: record.symbol,
        price: record.price,
        marketCap: record.marketCap,
        catalyst: record.catalyst,
        risks: record.risks,
        recommendation: record.recommendation,
        report: record.report,
        aiScore: record.aiScore,
        stage: record.stage,
        signalCount: record.signalCount,
        sourceCount: record.sourceCount,
        sources: [...(sourcesBySymbol.get(symbol) ?? [])],
        shortFloat: record.shortFloat,
        avgSentiment: record.avgSentiment,
        firstSeenDaysAgo: record.firstSeenDaysAgo,
        priorAppearances: record.priorAppearances,
        return7d: record.performance?.return7d ?? null,
        createdAt: record.createdAt.toISOString(),
        appearanceCount: countBySymbol.get(symbol) ?? 0,
        trend: trendMap.get(symbol) ?? "stable",
        scoreTrajectory: trajectoryMap.get(symbol) ?? [],
      };
    });

    return NextResponse.json({
      tickers,
      total,
      summary: {
        totalTrending: total,
        risingCount,
        fallingCount,
        stableCount,
        avgScore,
      },
    });
  } catch (err) {
    console.error("[/api/tickers/trending] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
