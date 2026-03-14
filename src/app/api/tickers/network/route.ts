import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { TTLCache } from "@/lib/cache";
import { getCoOccurringSymbols, getPairwiseEdges, jaccardScore } from "@/lib/co-occurrence";

export const networkCache = new TTLCache<unknown>(5 * 60 * 1000);

const networkSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()).optional(),
  minWeight: z.coerce.number().int().min(1).default(2),
  stage: z.enum(["EARLY", "FORMING", "CONFIRMED"]).optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
  maxNodes: z.coerce.number().int().min(2).max(50).default(30),
});

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const qp = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = networkSchema.safeParse(qp);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { symbol, minWeight, stage, days, maxNodes } = parsed.data;

    const cacheKey = `network:${symbol ?? ""}:${minWeight}:${stage ?? ""}:${days}:${maxNodes}`;
    const cached = networkCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, max-age=300" },
      });
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let nodeSymbols: string[];

    if (symbol) {
      // Symbol-centered: get its related tickers as nodes
      const coRows = await getCoOccurringSymbols(symbol, days, minWeight);
      nodeSymbols = [symbol, ...coRows.slice(0, maxNodes - 1).map((r) => r.symbol)];
    } else {
      // No center: use top symbols by appearance count
      const topRows = await prisma.$queryRaw<{ symbol: string }[]>`
        SELECT vt.symbol
        FROM "ValidatedTicker" vt
        JOIN "Scan" s ON s.id = vt."scanId"
        WHERE vt."createdAt" >= ${since}
          AND s.status = 'COMPLETED'
          AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
        GROUP BY vt.symbol
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        LIMIT ${maxNodes}
      `;
      nodeSymbols = topRows.map((r) => r.symbol);
    }

    if (nodeSymbols.length === 0) {
      const result = { nodes: [], edges: [], centerSymbol: symbol ?? null };
      networkCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    // Get pairwise edges
    const edges = await getPairwiseEdges(nodeSymbols, days, minWeight);

    // Fetch latest record per node symbol
    const latestRecords = await prisma.validatedTicker.findMany({
      where: {
        symbol: { in: nodeSymbols },
        scan: { status: "COMPLETED" },
        stage: stage ? stage : { notIn: ["FILTERED", "UNSCORED"] },
      },
      distinct: ["symbol"],
      orderBy: { createdAt: "desc" },
    });

    const latestBySymbol = new Map(latestRecords.map((r) => [r.symbol, r]));

    // Get appearance counts for Jaccard on edges
    const appearanceRows = await prisma.$queryRaw<{ symbol: string; cnt: number }[]>`
      SELECT vt.symbol, COUNT(DISTINCT vt."scanId")::int AS cnt
      FROM "ValidatedTicker" vt
      JOIN "Scan" s ON s.id = vt."scanId"
      WHERE vt.symbol = ANY(${nodeSymbols})
        AND vt."createdAt" >= ${since}
        AND s.status = 'COMPLETED'
        AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
      GROUP BY vt.symbol
    `;
    const totalMap = new Map(appearanceRows.map((r) => [r.symbol, r.cnt]));

    // Build nodes — only include symbols with a latest record
    const nodes = nodeSymbols
      .filter((s) => latestBySymbol.has(s))
      .map((sym) => {
        const record = latestBySymbol.get(sym)!;
        return {
          symbol: record.symbol,
          name: record.name,
          aiScore: record.aiScore,
          stage: record.stage,
          price: record.price,
          marketCap: record.marketCap,
          sector: record.sector,
          recommendation: record.recommendation,
          appearances: totalMap.get(sym) ?? 0,
        };
      });

    const nodeSet = new Set(nodes.map((n) => n.symbol));
    let validEdges = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));

    // Auto-thin: if too many edges, raise threshold to keep graph readable
    // Target: ~4 edges per node on average
    const maxEdges = nodes.length * 4;
    let effectiveMinWeight = minWeight;
    if (validEdges.length > maxEdges && !request.nextUrl.searchParams.has("minWeight")) {
      const weights = validEdges.map((e) => e.weight).sort((a, b) => a - b);
      const cutoffIdx = Math.max(0, weights.length - maxEdges);
      effectiveMinWeight = weights[cutoffIdx];
      validEdges = validEdges.filter((e) => e.weight >= effectiveMinWeight);
    }

    const filteredEdges = validEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      correlation: Math.round(
        jaccardScore(e.weight, totalMap.get(e.source) ?? 0, totalMap.get(e.target) ?? 0) * 100,
      ) / 100,
    }));

    const result = { nodes, edges: filteredEdges, centerSymbol: symbol ?? null, effectiveMinWeight };
    networkCache.set(cacheKey, result);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/tickers/network");
  }
}
