import { prisma } from "@/lib/prisma";
import type {
  RawSignal,
  AggregatedSymbol,
  FundamentalData,
  NoveltyContext,
} from "@/lib/harvester/types";

/**
 * Reconstruct AggregatedSymbol, FundamentalData, and NoveltyContext from
 * a ValidatedTicker + its DB signals. Shared by the on-demand report
 * endpoint and the batch report generator.
 */
export async function reconstructAggregatedSymbol(
  ticker: {
    id: string;
    symbol: string;
    scanId: string;
    sourceCount: number;
    weightedSourceScore: number | null;
    subredditCount: number | null;
    totalUpvotes: number | null;
    totalComments: number | null;
    avgVelocity: number | null;
    risingCount: number | null;
    freshCount: number | null;
    recentCount: number | null;
    commentDerivedCount: number | null;
    staleCount: number | null;
    price: number | null;
    marketCap: number | null;
    shortFloat: number | null;
    fiftyTwoWkRange: string | null;
    wk52Lo: number | null;
    wk52Hi: number | null;
    name: string | null;
    sector: string | null;
    exchange: string | null;
    firstSeenDaysAgo: number | null;
    priorAppearances: number;
  }
): Promise<{
  agg: AggregatedSymbol;
  fundamentals: FundamentalData | null;
  novelty: NoveltyContext;
  signals: RawSignal[];
}> {
  const signals = await prisma.signal.findMany({
    where: { scanId: ticker.scanId, symbol: ticker.symbol },
  });

  const rawSignals: RawSignal[] = signals.map((s) => ({
    symbol: s.symbol,
    source: s.source as RawSignal["source"],
    title: s.title ?? undefined,
    body: s.body ?? undefined,
    url: s.url ?? undefined,
    author: s.author ?? undefined,
    authorAge: s.authorAge ?? undefined,
    authorKarma: s.authorKarma ?? undefined,
    upvotes: s.upvotes ?? undefined,
    commentCount: s.commentCount ?? undefined,
    subreddit: s.subreddit ?? undefined,
    postAge: s.postAge ?? undefined,
    sortType: s.sortType ?? undefined,
    purchaseValue: s.purchaseValue ?? undefined,
    insiderTitle: s.insiderTitle ?? undefined,
    volumeRatio: s.volumeRatio ?? undefined,
    followerCount: s.followerCount ?? undefined,
    retweetCount: s.retweetCount ?? undefined,
    likeCount: s.likeCount ?? undefined,
    tweetType: s.tweetType ?? undefined,
  }));

  const agg: AggregatedSymbol = {
    symbol: ticker.symbol,
    signals: rawSignals,
    sourceCount: ticker.sourceCount,
    weightedSourceScore: ticker.weightedSourceScore ?? 0,
    subredditCount: ticker.subredditCount ?? 0,
    totalUpvotes: ticker.totalUpvotes ?? 0,
    totalComments: ticker.totalComments ?? 0,
    avgVelocity: ticker.avgVelocity ?? 0,
    momentum: {
      risingCount: ticker.risingCount ?? 0,
      freshCount: ticker.freshCount ?? 0,
      recentCount: ticker.recentCount ?? 0,
      commentDerivedCount: ticker.commentDerivedCount ?? 0,
      staleCount: ticker.staleCount ?? 0,
    },
    medianSignalAgeHrs: null,
  };

  const fundamentals: FundamentalData | null =
    ticker.price != null
      ? {
          price: ticker.price,
          marketCap: ticker.marketCap,
          shortFloat: ticker.shortFloat,
          fiftyTwoWeekRange: ticker.fiftyTwoWkRange ?? undefined,
          wk52Lo: ticker.wk52Lo,
          wk52Hi: ticker.wk52Hi,
          name: ticker.name ?? undefined,
          sector: ticker.sector ?? undefined,
          exchange: ticker.exchange ?? undefined,
        }
      : null;

  // Always reconstruct novelty context so report generation gets accurate isNovel signal.
  // - firstSeenDaysAgo === null && priorAppearances === 0  → truly novel (first appearance ever)
  // - firstSeenDaysAgo !== null || priorAppearances > 0   → known ticker, not novel
  const novelty: NoveltyContext = {
    firstSeenAt: null,
    daysSinceFirstSeen: ticker.firstSeenDaysAgo,
    priorAppearances: ticker.priorAppearances,
    isNovel: ticker.firstSeenDaysAgo === null && ticker.priorAppearances === 0,
  };

  return { agg, fundamentals, novelty, signals: rawSignals };
}
