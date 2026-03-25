import { prisma } from "@/lib/prisma";

/**
 * Pearson correlation coefficient between two arrays of numbers.
 * Returns null if fewer than minDataPoints overlapping values.
 */
export function pearsonCorrelation(
  xs: number[],
  ys: number[],
  minDataPoints = 5,
): number | null {
  if (xs.length !== ys.length || xs.length < minDataPoints) return null;

  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
    sumY2 += ys[i] * ys[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );

  if (denominator === 0) return null; // no variance
  return numerator / denominator;
}

interface SnapshotRow {
  symbol: string;
  price: number;
  createdAt: Date;
}

/**
 * Builds a map of symbol → daily prices keyed by YYYY-MM-DD.
 * When multiple snapshots exist on the same day, picks the latest (closing).
 */
export function buildDailyPriceMap(
  snapshots: SnapshotRow[],
): Map<string, Map<string, number>> {
  // Track latest timestamp per symbol+date to pick the closing snapshot
  const timestamps = new Map<string, Map<string, number>>();
  const bySymbol = new Map<string, Map<string, number>>();

  for (const snap of snapshots) {
    let dayMap = bySymbol.get(snap.symbol);
    let tsMap = timestamps.get(snap.symbol);
    if (!dayMap) {
      dayMap = new Map();
      tsMap = new Map();
      bySymbol.set(snap.symbol, dayMap);
      timestamps.set(snap.symbol, tsMap!);
    }

    const dateKey = snap.createdAt.toISOString().slice(0, 10);
    const existingTs = tsMap!.get(dateKey) ?? 0;
    const snapTs = snap.createdAt.getTime();

    if (snapTs > existingTs) {
      dayMap.set(dateKey, snap.price);
      tsMap!.set(dateKey, snapTs);
    }
  }

  return bySymbol;
}

/**
 * Computes daily returns from a price map.
 * Returns sorted array of { date, return } entries.
 */
export function computeDailyReturns(
  priceMap: Map<string, number>,
): { date: string; ret: number }[] {
  const sorted = [...priceMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const returns: { date: string; ret: number }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = sorted[i - 1][1];
    if (prevPrice === 0) continue;
    returns.push({
      date: sorted[i][0],
      ret: (sorted[i][1] - prevPrice) / prevPrice,
    });
  }

  return returns;
}

/**
 * Aligns two return series by date and returns paired arrays.
 */
export function alignReturns(
  returnsA: { date: string; ret: number }[],
  returnsB: { date: string; ret: number }[],
): { xs: number[]; ys: number[] } {
  const mapB = new Map(returnsB.map((r) => [r.date, r.ret]));
  const xs: number[] = [];
  const ys: number[] = [];

  for (const a of returnsA) {
    const bRet = mapB.get(a.date);
    if (bRet !== undefined) {
      xs.push(a.ret);
      ys.push(bRet);
    }
  }

  return { xs, ys };
}

export interface CorrelationEdge {
  source: string;
  target: string;
  correlation: number;
  dataPoints: number;
}

/**
 * Computes pairwise price-return correlations for a set of symbols
 * using PriceSnapshot data from the last `days` days.
 *
 * Returns edges with |correlation| >= minCorrelation.
 */
export async function getPairwiseCorrelations(
  symbols: string[],
  days: number,
  minCorrelation = 0.3,
  minDataPoints = 5,
): Promise<CorrelationEdge[]> {
  if (symbols.length < 2) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      symbol: { in: symbols },
      createdAt: { gte: since },
    },
    select: { symbol: true, price: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyPrices = buildDailyPriceMap(snapshots);

  // Pre-compute returns for each symbol
  const returnsBySymbol = new Map<string, { date: string; ret: number }[]>();
  for (const [sym, priceMap] of dailyPrices) {
    returnsBySymbol.set(sym, computeDailyReturns(priceMap));
  }

  const edges: CorrelationEdge[] = [];

  // All pairs
  for (let i = 0; i < symbols.length; i++) {
    const returnsA = returnsBySymbol.get(symbols[i]);
    if (!returnsA || returnsA.length < minDataPoints) continue;

    for (let j = i + 1; j < symbols.length; j++) {
      const returnsB = returnsBySymbol.get(symbols[j]);
      if (!returnsB || returnsB.length < minDataPoints) continue;

      const { xs, ys } = alignReturns(returnsA, returnsB);
      const r = pearsonCorrelation(xs, ys, minDataPoints);

      if (r !== null && Math.abs(r) >= minCorrelation) {
        edges.push({
          source: symbols[i],
          target: symbols[j],
          correlation: Math.round(r * 100) / 100,
          dataPoints: xs.length,
        });
      }
    }
  }

  // Sort by absolute correlation descending
  edges.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  return edges;
}
