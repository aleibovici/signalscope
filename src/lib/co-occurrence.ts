import { prisma } from "@/lib/prisma";

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 */
export function jaccardScore(coCount: number, totalA: number, totalB: number): number {
  const union = totalA + totalB - coCount;
  if (union <= 0) return 0;
  return coCount / union;
}

export interface CoOccurrence {
  symbol: string;
  coCount: number;
  targetTotal: number;
}

/**
 * Find symbols that co-occur with `symbol` in the same scans.
 */
export async function getCoOccurringSymbols(
  symbol: string,
  days: number,
  minCoOccurrences: number,
): Promise<CoOccurrence[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return prisma.$queryRaw<CoOccurrence[]>`
    WITH target_scans AS (
      SELECT vt."scanId"
      FROM "ValidatedTicker" vt
      JOIN "Scan" s ON s.id = vt."scanId"
      WHERE vt.symbol = ${symbol}
        AND vt."createdAt" >= ${since}
        AND s.status = 'COMPLETED'
        AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
    ),
    target_count AS (
      SELECT COUNT(*)::int AS total FROM target_scans
    )
    SELECT vt.symbol, COUNT(DISTINCT vt."scanId")::int AS "coCount", tc.total AS "targetTotal"
    FROM "ValidatedTicker" vt
    CROSS JOIN target_count tc
    WHERE vt."scanId" IN (SELECT "scanId" FROM target_scans)
      AND vt.symbol != ${symbol}
      AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
    GROUP BY vt.symbol, tc.total
    HAVING COUNT(DISTINCT vt."scanId") >= ${minCoOccurrences}
    ORDER BY COUNT(DISTINCT vt."scanId") DESC
  `;
}

export interface PairwiseEdge {
  source: string;
  target: string;
  weight: number;
}

/**
 * Get pairwise co-occurrence edges between the given symbols.
 */
export async function getPairwiseEdges(
  symbols: string[],
  days: number,
  minWeight: number,
): Promise<PairwiseEdge[]> {
  if (symbols.length < 2) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return prisma.$queryRaw<PairwiseEdge[]>`
    WITH node_scans AS (
      SELECT vt.symbol, vt."scanId"
      FROM "ValidatedTicker" vt
      JOIN "Scan" s ON s.id = vt."scanId"
      WHERE vt.symbol = ANY(${symbols})
        AND vt."createdAt" >= ${since}
        AND s.status = 'COMPLETED'
        AND vt.stage NOT IN ('FILTERED', 'UNSCORED')
    )
    SELECT a.symbol AS source, b.symbol AS target, COUNT(*)::int AS weight
    FROM node_scans a
    JOIN node_scans b ON a."scanId" = b."scanId" AND a.symbol < b.symbol
    GROUP BY a.symbol, b.symbol
    HAVING COUNT(*) >= ${minWeight}
  `;
}
