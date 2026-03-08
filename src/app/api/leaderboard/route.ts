import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { paginationSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-error";
import { TTLCache } from "@/lib/cache";

export const leaderboardCache = new TTLCache<unknown>(5 * 60 * 1000);

const TIMEFRAMES = [3, 7, 30] as const;

interface PositionGain {
  gainPct: number;
  symbol: string;
  openedAt: Date;
  verified: boolean;
}

interface UserAgg {
  username: string;
  positions: PositionGain[];
}

function computeStats(gains: PositionGain[]) {
  if (gains.length === 0) return null;
  const sum = gains.reduce((a, b) => a + b.gainPct, 0);
  const avgGainPct = Math.round((sum / gains.length) * 100) / 100;
  const wins = gains.filter((g) => g.gainPct > 0).length;
  const winRate = Math.round((wins / gains.length) * 100) / 100;
  let best = gains[0];
  for (const g of gains) {
    if (g.gainPct > best.gainPct) best = g;
  }
  return {
    avgGainPct,
    positionCount: gains.length,
    winRate,
    bestSymbol: best.symbol,
    bestGainPct: best.gainPct,
  };
}

export async function GET(_request: NextRequest) {
  try {
    await getCurrentUserId();

    return NextResponse.json(
      { error: "Leaderboard is temporarily disabled" },
      { status: 503 }
    );

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = paginationSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { page, limit } = parsed.data;

    const cacheKey = `leaderboard:${page}:${limit}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, max-age=300" },
      });
    }

    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all positions opened within last 30 days for users with usernames
    const positions = await prisma.userPosition.findMany({
      where: {
        openedAt: { gte: cutoff30d },
        entryPrice: { gt: 0 },
        user: { username: { not: null } },
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    // Get latest snapshot price per unique open symbol
    const openSymbols = [
      ...new Set(
        positions.filter((p) => p.status === "OPEN").map((p) => p.symbol)
      ),
    ];

    const snapshotMap = new Map<string, { price: number; createdAt: Date }>();
    if (openSymbols.length > 0) {
      const snapshots = await prisma.priceSnapshot.findMany({
        where: { symbol: { in: openSymbols } },
        distinct: ["symbol"],
        orderBy: { createdAt: "desc" },
        select: { symbol: true, price: true, createdAt: true },
      });
      for (const s of snapshots) {
        snapshotMap.set(s.symbol, { price: s.price, createdAt: s.createdAt });
      }
    }

    let pricesAsOf: Date | null = null;
    for (const s of snapshotMap.values()) {
      if (!pricesAsOf || s.createdAt > pricesAsOf) {
        pricesAsOf = s.createdAt;
      }
    }

    // Compute gain per position and group by user
    const userMap = new Map<string, UserAgg>();

    for (const pos of positions) {
      let currentPrice: number | null = null;
      if (pos.status === "CLOSED") {
        currentPrice = pos.closePrice;
      } else {
        const snap = snapshotMap.get(pos.symbol);
        if (snap) currentPrice = snap.price;
      }

      if (currentPrice == null) continue;

      const gainPct =
        Math.round(((currentPrice - pos.entryPrice) / pos.entryPrice) * 10000) / 100;

      const userId = pos.user.id;
      let agg = userMap.get(userId);
      if (!agg) {
        agg = { username: pos.user.username!, positions: [] };
        userMap.set(userId, agg);
      }
      agg.positions.push({ gainPct, symbol: pos.symbol, openedAt: pos.openedAt, verified: pos.verified });
    }

    // Build entries with stats for each timeframe
    const now = Date.now();
    const cutoffs = TIMEFRAMES.map((d) => new Date(now - d * 24 * 60 * 60 * 1000));

    const entries = [...userMap.values()]
      .map((agg) => {
        const byTimeframe: Record<string, ReturnType<typeof computeStats>> = {};
        for (let i = 0; i < TIMEFRAMES.length; i++) {
          const filtered = agg.positions.filter((p) => p.openedAt >= cutoffs[i]);
          byTimeframe[`${TIMEFRAMES[i]}d`] = computeStats(filtered);
        }
        // Overall stats use 30d window (all positions)
        const all = computeStats(agg.positions);
        const verifiedCount = agg.positions.filter((p) => p.verified).length;
        const verifiedRate = agg.positions.length > 0
          ? Math.round((verifiedCount / agg.positions.length) * 100) / 100
          : 0;
        return {
          username: agg.username,
          gain3d: byTimeframe["3d"]?.avgGainPct ?? null,
          gain7d: byTimeframe["7d"]?.avgGainPct ?? null,
          gain30d: byTimeframe["30d"]?.avgGainPct ?? null,
          positionCount: all?.positionCount ?? 0,
          winRate: all?.winRate ?? 0,
          bestSymbol: all?.bestSymbol ?? "",
          bestGainPct: all?.bestGainPct ?? 0,
          verifiedRate,
        };
      })
      .sort((a, b) => (b.gain7d ?? -Infinity) - (a.gain7d ?? -Infinity));

    const total = entries.length;
    const start = (page - 1) * limit;
    const pageEntries = entries.slice(start, start + limit).map((e, i) => ({
      rank: start + i + 1,
      ...e,
    }));

    const result = {
      leaderboard: pageEntries,
      total,
      pricesAsOf: pricesAsOf?.toISOString() ?? null,
    };
    leaderboardCache.set(cacheKey, result);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return handleApiError(err, "/api/leaderboard");
  }
}
