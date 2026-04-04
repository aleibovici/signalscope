import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { paginationSchema } from "@/lib/validators";
import { TTLCache } from "@/lib/cache";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";
import { stageLabel, stageToDb, API_STAGE_VALUES } from "@/lib/stage-labels";

export const trendingCache = new TTLCache<unknown>(5 * 60 * 1000);

const SOURCES = ["REDDIT", "TWITTER", "STOCKTWITS", "SEC_INSIDER", "CONGRESS", "VOLUME_SPIKE", "OPTIONS_FLOW", "POLYMARKET"] as const;

const MARKET_CAP_RANGES: Record<string, { min: number; max: number }> = {
  micro: { min: 0, max: 300_000_000 },
  small: { min: 300_000_000, max: 2_000_000_000 },
  mid: { min: 2_000_000_000, max: 10_000_000_000 },
  large: { min: 10_000_000_000, max: Infinity },
};

const trendingSchema = paginationSchema.extend({
  minAppearances: z.coerce.number().int().min(2).default(2),
  stage: z.enum([...API_STAGE_VALUES, "EARLY", "FORMING", "CONFIRMED"]).transform((v) => stageToDb(v)!).optional(),
  trend: z.enum(["rising", "falling", "stable"]).optional(),
  sector: z.string().optional(),
  marketCap: z.enum(["micro", "small", "mid", "large"]).optional(),
  sortBy: z.enum(["appearances", "aiScore", "opportunityScore", "price", "return", "marketCap"]).default("appearances"),
  source: z.enum(SOURCES).optional(),
  hidePnd: z.coerce.boolean().default(false),
  returnPeriod: z.enum(["1d", "3d", "7d", "30d"]).default("7d"),
  near52wLow: z.coerce.boolean().default(false),
});

const RETURN_FIELD_MAP: Record<string, "return1d" | "return3d" | "return7d" | "return30d"> = {
  "1d": "return1d",
  "3d": "return3d",
  "7d": "return7d",
  "30d": "return30d",
};

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

async function handleTrending(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = trendingSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { page, limit, minAppearances, stage, trend, sector, marketCap, sortBy, source, hidePnd, returnPeriod, near52wLow } = parsed.data;

  const cacheKey = `trending:${page}:${limit}:${minAppearances}:${stage ?? ""}:${trend ?? ""}:${sector ?? ""}:${marketCap ?? ""}:${sortBy}:${source ?? ""}:${hidePnd}:${returnPeriod}:${near52wLow}`;
  const cached = trendingCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Find qualifying symbols via raw SQL (groupBy + relation filter on scan.status)
  const qualifyingRows = await prisma.$queryRaw<{ symbol: string; cnt: bigint }[]>`
    SELECT vt.symbol, COUNT(*)::bigint AS cnt
    FROM "ValidatedTicker" vt
    JOIN "Scan" s ON s.id = vt."scanId"
    WHERE vt."createdAt" >= ${thirtyDaysAgo}
      AND s.status = 'COMPLETED'
      AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
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
      stage: { notIn: ["FILTERED", "UNSCORED"] },
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
      stage: stageLabel(a.stage),
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

  // 3. Fetch latest record per symbol (only fields used in response)
  const latestRecords = await prisma.validatedTicker.findMany({
    where: {
      symbol: { in: filteredSymbols },
      scan: { status: "COMPLETED" },
      stage: stage ? stage : { notIn: ["FILTERED", "UNSCORED"] },
      ...(sector ? { sector } : {}),
      ...(hidePnd ? { pndFlagged: false } : {}),
    },
    distinct: ["symbol"],
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scanId: true,
      symbol: true,
      name: true,
      price: true,
      marketCap: true,
      sector: true,
      catalyst: true,
      risks: true,
      recommendation: true,
      aiScore: true,
      opportunityScore: true,
      stage: true,
      signalCount: true,
      sourceCount: true,
      shortFloat: true,
      avgSentiment: true,
      firstSeenDaysAgo: true,
      priorAppearances: true,
      exchange: true,
      wk52Lo: true,
      wk52Hi: true,
      pndFlagged: true,
      pndScore: true,
      pndFlags: true,
      subredditCount: true,
      createdAt: true,
      performance: { select: { return1d: true, return3d: true, return7d: true, return30d: true } },
    },
  });

  // Apply stage/sector/pnd filter — only keep symbols that have a matching latest record
  const latestBySymbol = new Map(latestRecords.map((r) => [r.symbol, r]));
  if (stage || sector || hidePnd) {
    filteredSymbols = filteredSymbols.filter((s) => latestBySymbol.has(s));
  }

  // Apply market cap bucket filter
  if (marketCap) {
    const range = MARKET_CAP_RANGES[marketCap];
    filteredSymbols = filteredSymbols.filter((s) => {
      const mc = latestBySymbol.get(s)?.marketCap;
      return mc != null && mc >= range.min && mc < range.max;
    });
  }

  // Apply near 52-week low filter
  if (near52wLow) {
    filteredSymbols = filteredSymbols.filter((s) => {
      const r = latestBySymbol.get(s);
      if (!r || r.price == null || r.wk52Lo == null || r.wk52Lo <= 0) return false;
      const pct = (r.price - r.wk52Lo) / r.wk52Lo;
      return pct >= 0.007 && pct < 0.50;
    });
  }

  // Fetch distinct signal sources for latest scan per symbol
  const latestScanIds = [
    ...new Set(
      filteredSymbols
        .map((s) => latestBySymbol.get(s)?.scanId)
        .filter((id): id is string => id != null)
    ),
  ];
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

  // Apply source filter
  if (source) {
    filteredSymbols = filteredSymbols.filter((s) => sourcesBySymbol.get(s)?.has(source));
  }

  // Build sorted results
  const returnField = RETURN_FIELD_MAP[returnPeriod];
  const sortedSymbols = filteredSymbols
    .filter((s) => latestBySymbol.has(s))
    .sort((a, b) => {
      const ra = latestBySymbol.get(a)!;
      const rb = latestBySymbol.get(b)!;
      switch (sortBy) {
        case "aiScore":
          return rb.aiScore - ra.aiScore;
        case "opportunityScore":
          return (rb.opportunityScore ?? 0) - (ra.opportunityScore ?? 0);
        case "price":
          return (rb.price ?? 0) - (ra.price ?? 0);
        case "return": {
          const retA = ra.performance?.[returnField] ?? -Infinity;
          const retB = rb.performance?.[returnField] ?? -Infinity;
          return retB - retA;
        }
        case "marketCap":
          return (rb.marketCap ?? 0) - (ra.marketCap ?? 0);
        case "appearances":
        default: {
          const countDiff = (countBySymbol.get(b) ?? 0) - (countBySymbol.get(a) ?? 0);
          if (countDiff !== 0) return countDiff;
          return (rb.opportunityScore ?? 0) - (ra.opportunityScore ?? 0);
        }
      }
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
      name: record.name,
      price: record.price,
      marketCap: record.marketCap,
      sector: record.sector,
      catalyst: record.catalyst,
      risks: record.risks,
      recommendation: record.recommendation,
      report: record.report,
      aiScore: record.aiScore,
      opportunityScore: record.opportunityScore,
      stage: stageLabel(record.stage),
      signalCount: record.signalCount,
      sourceCount: record.sourceCount,
      sources: [...(sourcesBySymbol.get(symbol) ?? [])],
      shortFloat: record.shortFloat,
      avgSentiment: record.avgSentiment,
      firstSeenDaysAgo: record.firstSeenDaysAgo,
      priorAppearances: record.priorAppearances,
      exchange: record.exchange,
      wk52Lo: record.wk52Lo,
      wk52Hi: record.wk52Hi,
      pndFlagged: record.pndFlagged,
      pndScore: record.pndScore,
      pndFlags: record.pndFlags,
      subredditCount: record.subredditCount,
      return1d: record.performance?.return1d ?? null,
      return3d: record.performance?.return3d ?? null,
      return7d: record.performance?.return7d ?? null,
      return30d: record.performance?.return30d ?? null,
      createdAt: record.createdAt.toISOString(),
      appearanceCount: countBySymbol.get(symbol) ?? 0,
      trend: trendMap.get(symbol) ?? "stable",
      scoreTrajectory: trajectoryMap.get(symbol) ?? [],
    };
  });

  const result = {
    tickers,
    total,
    summary: {
      totalTrending: total,
      risingCount,
      fallingCount,
      stableCount,
      avgScore,
    },
  };
  trendingCache.set(cacheKey, result);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

// x402 payment-wrapped handler (created once at module level)
const x402Handler = X402_ENABLED
  ? withX402Logged(handleTrending, x402RouteConfigs.trending, "trending")
  : null;

export async function GET(request: NextRequest) {
  try {
    // Authenticated users (session, Bearer token, API key) — normal path
    if (hasAuthCredentials(request)) {
      await getCurrentUserId();
      return await handleTrending(request);
    }

    // x402 payment present — validate payment (AI agent flow)
    if (request.headers.has("x-payment") && x402Handler) {
      return x402Handler(request);
    }

    // Free anonymous access (browser users)
    return await handleTrending(request);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/trending");
  }
}
