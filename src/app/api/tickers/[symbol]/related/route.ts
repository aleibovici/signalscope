import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { paginationSchema } from "@/lib/validators";
import { TTLCache } from "@/lib/cache";
import { getCoOccurringSymbols } from "@/lib/co-occurrence";
import { getPairwiseCorrelations } from "@/lib/price-correlation";
import { withX402Logged, x402RouteConfigs, hasAuthCredentials, X402_ENABLED } from "@/lib/x402";
import { stageLabel, stageToDb, API_STAGE_VALUES } from "@/lib/stage-labels";

export const relatedCache = new TTLCache<unknown>(5 * 60 * 1000);

const relatedSchema = paginationSchema.extend({
  minCoOccurrences: z.coerce.number().int().min(1).default(2),
  days: z.coerce.number().int().min(1).max(90).default(30),
  stage: z.enum([...API_STAGE_VALUES, "EARLY", "FORMING", "CONFIRMED"]).transform((v) => stageToDb(v)!).optional(),
});

async function handleRelated(request: NextRequest, upperSymbol: string) {
  const qp = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = relatedSchema.safeParse(qp);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { page, limit, minCoOccurrences, days, stage } = parsed.data;

  const cacheKey = `related:${upperSymbol}:${page}:${limit}:${minCoOccurrences}:${days}:${stage ?? ""}`;
  const cached = relatedCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  const coRows = await getCoOccurringSymbols(upperSymbol, days, minCoOccurrences);

  if (coRows.length === 0) {
    const result = { relatedTickers: [], targetSymbol: upperSymbol, targetScanCount: 0, total: 0 };
    relatedCache.set(cacheKey, result);
    return NextResponse.json(result);
  }

  const targetTotal = coRows[0].targetTotal;
  const coSymbols = coRows.map((r) => r.symbol);

  // Compute price correlations between target and all co-occurring symbols
  const corrEdges = await getPairwiseCorrelations([upperSymbol, ...coSymbols], days, 0);
  const corrMap = new Map<string, { correlation: number; dataPoints: number }>();
  for (const e of corrEdges) {
    const other = e.source === upperSymbol ? e.target : e.target === upperSymbol ? e.source : null;
    if (other) corrMap.set(other, { correlation: e.correlation, dataPoints: e.dataPoints });
  }

  const latestRecords = await prisma.validatedTicker.findMany({
    where: {
      symbol: { in: coSymbols },
      scan: { status: "COMPLETED" },
      stage: stage ? stage : { notIn: ["FILTERED", "UNSCORED"] },
    },
    distinct: ["symbol"],
    orderBy: { createdAt: "desc" },
    select: {
      symbol: true,
      name: true,
      aiScore: true,
      stage: true,
      sector: true,
      price: true,
      marketCap: true,
      recommendation: true,
      scanId: true,
    },
  });

  const latestBySymbol = new Map(latestRecords.map((r) => [r.symbol, r]));

  const latestScanIds = [...new Set(latestRecords.map((r) => r.scanId))];
  const signalSources = await prisma.signal.findMany({
    where: {
      scanId: { in: latestScanIds },
      symbol: { in: coSymbols },
    },
    select: { symbol: true, source: true },
    distinct: ["symbol", "source"],
  });

  const sourcesBySymbol = new Map<string, string[]>();
  for (const s of signalSources) {
    let arr = sourcesBySymbol.get(s.symbol);
    if (!arr) {
      arr = [];
      sourcesBySymbol.set(s.symbol, arr);
    }
    if (!arr.includes(s.source)) arr.push(s.source);
  }

  const filtered = coSymbols.filter((s) => latestBySymbol.has(s));
  // Sort by absolute price correlation descending (no correlation data → bottom)
  filtered.sort((a, b) => {
    const corrA = corrMap.get(a);
    const corrB = corrMap.get(b);
    return (corrB ? Math.abs(corrB.correlation) : -1) - (corrA ? Math.abs(corrA.correlation) : -1);
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const pageSymbols = filtered.slice(start, start + limit);

  const relatedTickers = pageSymbols.map((sym) => {
    const record = latestBySymbol.get(sym)!;
    const corr = corrMap.get(sym);
    return {
      symbol: record.symbol,
      name: record.name,
      correlationScore: corr?.correlation ?? null,
      correlationDataPoints: corr?.dataPoints ?? 0,
      latestAiScore: record.aiScore,
      latestStage: stageLabel(record.stage),
      sector: record.sector,
      sources: sourcesBySymbol.get(sym) ?? [],
      price: record.price,
      marketCap: record.marketCap,
      recommendation: record.recommendation,
    };
  });

  const result = { relatedTickers, targetSymbol: upperSymbol, targetScanCount: targetTotal, total };
  relatedCache.set(cacheKey, result);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

const x402Handler = X402_ENABLED
  ? withX402Logged(
      (async (request: NextRequest) => {
        const url = new URL(request.url);
        const symbol = url.pathname.split("/")[3]?.toUpperCase();
        if (!symbol) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        return handleRelated(request, symbol);
      }) as (request: NextRequest) => Promise<NextResponse<unknown>>,
      x402RouteConfigs.related,
      "related",
    )
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    if (hasAuthCredentials(request)) {
      await getCurrentUserId();
      return await handleRelated(request, upperSymbol);
    }

    if (request.headers.has("x-payment") && x402Handler) {
      return x402Handler(request);
    }

    return await handleRelated(request, upperSymbol);
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/[symbol]/related");
  }
}
