import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const watchlist = await prisma.userWatchlist.findMany({
      where: { userId },
      select: { symbol: true },
    });

    if (watchlist.length === 0) {
      return NextResponse.json({ tickers: [] });
    }

    const symbols = watchlist.map((w) => w.symbol);

    // For each watchlisted symbol, get the most recent ValidatedTicker.
    // Use a raw query with DISTINCT ON to efficiently get one row per symbol.
    const latestTickers = await prisma.validatedTicker.findMany({
      where: { symbol: { in: symbols } },
      orderBy: [{ symbol: "asc" }, { createdAt: "desc" }],
      distinct: ["symbol"],
      include: {
        performance: { select: { return7d: true } },
      },
    });

    // Fetch sources for each ticker from its scan
    const scanSymbolPairs = latestTickers.map((t) => ({
      scanId: t.scanId,
      symbol: t.symbol,
    }));

    const signals =
      scanSymbolPairs.length > 0
        ? await prisma.signal.findMany({
            where: {
              OR: scanSymbolPairs.map((p) => ({
                scanId: p.scanId,
                symbol: p.symbol,
              })),
            },
            select: { symbol: true, source: true, scanId: true },
            distinct: ["symbol", "source", "scanId"],
          })
        : [];

    const sourcesByKey = new Map<string, Set<string>>();
    for (const s of signals) {
      const key = `${s.scanId}:${s.symbol}`;
      let set = sourcesByKey.get(key);
      if (!set) {
        set = new Set<string>();
        sourcesByKey.set(key, set);
      }
      set.add(s.source);
    }

    const tickers = latestTickers.map((t) => {
      const key = `${t.scanId}:${t.symbol}`;
      return {
        ...t,
        return7d: t.performance?.return7d ?? null,
        performance: undefined,
        sources: [...(sourcesByKey.get(key) ?? [])],
      };
    });

    return NextResponse.json({ tickers });
  } catch (error) {
    return handleApiError(error, "/api/watchlist/tickers GET");
  }
}
