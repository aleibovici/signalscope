import { prisma, createDevPrismaClient } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AggregatedSymbol, NoveltyContext, PndAiResult, RawSignal, SignalType } from "./types";
import { fetchRedditSignals } from "./sources/reddit";
import { fetchStockTwitsSignals } from "./sources/stocktwits";
import { fetchSecInsiderSignals } from "./sources/sec-insider";
import { fetchOptionsFlowSignals } from "./sources/options-flow";
import { fetchVolumeSpikeSignals } from "./sources/volume-spike";
import { fetchTwitterSignals } from "./sources/twitter";
import { fetchCongressSignals } from "./sources/congress";
import { scoreSymbolBatch, defaultScore } from "./scoring";
import { checkPndFlags, aiPndAssessment } from "./pnd-filter";
import { fetchFundamentals } from "./fundamentals";
import { generateTickerReport } from "./report";
import { resetCostTracker, getTotalCost } from "@/lib/ai";

const SOURCE_WEIGHTS: Record<string, number> = {
  SEC_INSIDER: 3,
  OPTIONS_FLOW: 2.5,
  VOLUME_SPIKE: 2,
  CONGRESS: 2.5,
  TWITTER: 1.2,
  SEC_FILING: 1,
  REDDIT: 1,
  STOCKTWITS: 1,
};

export function aggregateSignals(signals: RawSignal[]): AggregatedSymbol[] {
  const bySymbol = new Map<string, RawSignal[]>();

  for (const signal of signals) {
    const existing = bySymbol.get(signal.symbol) || [];
    existing.push(signal);
    bySymbol.set(signal.symbol, existing);
  }

  return [...bySymbol.entries()]
    .map(([symbol, sigs]) => {
      const uniqueSources = [...new Set(sigs.map((s) => s.source))];
      return {
        symbol,
        signals: sigs,
        sourceCount: uniqueSources.length,
        weightedSourceScore: uniqueSources.reduce(
          (sum, src) => sum + (SOURCE_WEIGHTS[src] || 1),
          0
        ),
        subredditCount: new Set(
          sigs.filter((s) => s.source === "REDDIT" && s.subreddit).map((s) => s.subreddit)
        ).size,
        totalUpvotes: sigs.reduce((sum, s) => sum + (s.upvotes || 0), 0),
        totalComments: sigs.reduce((sum, s) => sum + (s.commentCount || 0), 0),
        avgVelocity: (() => {
          const socialSigs = sigs.filter((s) => s.postAge != null && s.sortType);
          if (socialSigs.length === 0) return 0;
          const velocitySum = socialSigs.reduce((sum, s) => {
            if (s.sortType === "rising") return sum + 3;
            if (s.sortType === "trending") return sum + 1.5;
            if (s.sortType === "comment") return sum + 1.5;
            if (s.postAge! < 3) return sum + 2;
            if (s.postAge! < 12) return sum + 1;
            return sum + 0.5;
          }, 0);
          return velocitySum / socialSigs.length;
        })(),
        momentum: sigs.reduce(
          (m, s) => {
            if (s.postAge != null && s.sortType) {
              if (s.sortType === "rising") m.risingCount++;
              else if (s.sortType === "trending") m.recentCount++;
              else if (s.sortType === "comment") m.commentDerivedCount++;
              else if (s.postAge < 3) m.freshCount++;
              else if (s.postAge < 12) m.recentCount++;
              else m.staleCount++;
            }
            return m;
          },
          { risingCount: 0, freshCount: 0, recentCount: 0, commentDerivedCount: 0, staleCount: 0 }
        ),
        medianSignalAgeHrs: (() => {
          const ages = sigs
            .filter((s) => s.postAge != null)
            .map((s) => s.postAge!);
          if (ages.length === 0) return null;
          ages.sort((a, b) => a - b);
          const mid = Math.floor(ages.length / 2);
          return ages.length % 2 === 0
            ? (ages[mid - 1] + ages[mid]) / 2
            : ages[mid];
        })(),
      };
    })
    .sort((a, b) => b.sourceCount - a.sourceCount || b.signals.length - a.signals.length);
}

async function lookupNovelty(
  symbols: string[],
  currentScanId: string
): Promise<Map<string, NoveltyContext>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const priorTickers = await prisma.validatedTicker.findMany({
    where: {
      symbol: { in: symbols },
      createdAt: { gte: thirtyDaysAgo },
      scanId: { not: currentScanId },
    },
    select: { symbol: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const grouped = new Map<string, Date[]>();
  for (const t of priorTickers) {
    const dates = grouped.get(t.symbol) || [];
    dates.push(t.createdAt);
    grouped.set(t.symbol, dates);
  }

  const now = new Date();
  const noveltyMap = new Map<string, NoveltyContext>();

  for (const symbol of symbols) {
    const dates = grouped.get(symbol);
    if (!dates || dates.length === 0) {
      noveltyMap.set(symbol, {
        firstSeenAt: null,
        daysSinceFirstSeen: null,
        priorAppearances: 0,
        isNovel: true,
      });
    } else {
      const firstSeen = dates[0];
      const daysSince = Math.floor(
        (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
      );
      noveltyMap.set(symbol, {
        firstSeenAt: firstSeen,
        daysSinceFirstSeen: daysSince,
        priorAppearances: dates.length,
        isNovel: false,
      });
    }
  }

  return noveltyMap;
}

function parsePctFrom52wkLow(
  price: number | null | undefined,
  wk52Lo: number | null | undefined,
  fiftyTwoWeekRange?: string,
): number | undefined {
  if (!price) return undefined;
  if (wk52Lo != null && wk52Lo > 0) return (price - wk52Lo) / wk52Lo;
  if (fiftyTwoWeekRange) {
    const match = fiftyTwoWeekRange.match(/^([\d.]+)\s*-\s*[\d.]+$/);
    if (match) {
      const low = parseFloat(match[1]);
      if (low > 0) return (price - low) / low;
    }
  }
  return undefined;
}

export function determineStage(
  aiScore: number,
  sourceCount: number,
  weightedSourceScore: number,
  avgVelocity: number,
  pndFlagged: boolean,
  hasNonSocialSource: boolean,
  novelty?: NoveltyContext,
  subredditCount?: number,
  pctFrom52wkLow?: number,
  wk52Lo?: number,
  isAmexPenny?: boolean,
  isNasdaqSmallPenny?: boolean,
  medianSignalAgeHrs?: number | null,
): "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" {
  if (pndFlagged) return "FILTERED";

  // Sub-dime 52wk floor = zombie/shell stock: cap at EARLY unless a hard catalyst exists
  if (wk52Lo != null && wk52Lo < 0.09 && !hasNonSocialSource) return "EARLY";

  const effectiveScore = novelty?.isNovel ? aiScore + 5 : aiScore;

  if (hasNonSocialSource && effectiveScore >= 70 && sourceCount >= 3) return "CONFIRMED";
  if (hasNonSocialSource && effectiveScore >= 65 && weightedSourceScore >= 4) return "CONFIRMED";
  if (hasNonSocialSource && effectiveScore >= 65 && sourceCount >= 2 && avgVelocity >= 2.0) return "CONFIRMED";

  // Reddit CONFIRMED: cross-community consensus is structural multi-source corroboration
  // Require signals to be fresh (median age < 6h) — stale consensus means the move already happened
  const signalsFresh = medianSignalAgeHrs == null || medianSignalAgeHrs < 6;
  if (!hasNonSocialSource && (subredditCount ?? 0) >= 3 && effectiveScore >= 48 && avgVelocity >= 2.5 && signalsFresh) {
    return "CONFIRMED";
  }

  // NYSE American micro-cap recovering from 52wk floor (but not sub-dime garbage)
  if (isAmexPenny && wk52Lo != null && wk52Lo >= 0.09 && wk52Lo < 1.0 &&
      pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 &&
      effectiveScore >= 48 && avgVelocity >= 2.0) {
    return "CONFIRMED";
  }

  // NasdaqCM/NasdaqGM penny: same breakout pattern, slightly higher score bar
  if (isNasdaqSmallPenny && wk52Lo != null && wk52Lo >= 0.09 && wk52Lo < 1.0 &&
      pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 &&
      effectiveScore >= 50 && avgVelocity >= 2.0) {
    return "CONFIRMED";
  }

  if (effectiveScore >= 50 && sourceCount >= 2) return "FORMING";

  const formingVelocityThreshold =
    pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 && wk52Lo != null && wk52Lo >= 0.09 && wk52Lo < 1.0 ? 37 :
    pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 ? 40 : 45;
  if (effectiveScore >= formingVelocityThreshold && avgVelocity >= 2.0) return "FORMING";

  // Novel tickers with decent score and multi-source get promoted
  if (novelty?.isNovel && aiScore >= 40 && sourceCount >= 2) return "FORMING";

  if (isAmexPenny && wk52Lo != null && wk52Lo >= 0.09 &&
      pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 &&
      effectiveScore >= 40 && avgVelocity >= 1.5) return "FORMING";

  if (isNasdaqSmallPenny && wk52Lo != null && wk52Lo >= 0.09 &&
      pctFrom52wkLow != null && pctFrom52wkLow >= 0.007 &&
      effectiveScore >= 42 && avgVelocity >= 1.5) return "FORMING";

  if ((subredditCount ?? 0) >= 3 && effectiveScore >= 40 && avgVelocity >= 1.5) return "FORMING";

  return "EARLY";
}

function classifySignalType(agg: AggregatedSymbol): SignalType {
  const sources = new Set(agg.signals.map((s) => s.source));
  const hasReddit = sources.has("REDDIT");
  const hasStockTwits = sources.has("STOCKTWITS");
  const hasTwitter = sources.has("TWITTER");
  const hasInsider = sources.has("SEC_INSIDER");
  const hasOptions = sources.has("OPTIONS_FLOW");
  const hasVolume = sources.has("VOLUME_SPIKE");
  const hasCongress = sources.has("CONGRESS");

  // Multi-source: social (Reddit/StockTwits/Twitter) + at least one of insider/options/volume/congress
  if ((hasReddit || hasStockTwits || hasTwitter) && (hasInsider || hasOptions || hasVolume || hasCongress) && sources.size >= 3) {
    return "multi_source";
  }

  // Insider buy: has SEC insider signal (Form 4 open market purchase)
  if (hasInsider) {
    return "insider_buy";
  }

  // Congress buy: congressional STOCK Act disclosure
  if (hasCongress) {
    return "congress_buy";
  }

  // Options flow: unusual call sweep/volume
  if (hasOptions) {
    return "options_flow";
  }

  // Twitter velocity: Twitter-only signals
  if (hasTwitter && !hasReddit && !hasStockTwits) {
    return "twitter_velocity";
  }

  // StockTwits velocity: StockTwits-only signals
  if (hasStockTwits && !hasReddit && !hasTwitter) {
    return "twitter_velocity"; // closest existing type
  }

  // Reddit velocity: Reddit-only but with strong velocity
  return "reddit_velocity";
}

async function mirrorToDevDb(
  devPrisma: PrismaClient | null,
  label: string,
  fn: (client: PrismaClient) => Promise<void>
) {
  if (!devPrisma) return;
  try {
    await fn(devPrisma);
  } catch (err) {
    console.warn(`[dev-db] Failed to mirror ${label}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Fetch raw signals from all sources in parallel (network-bound, needs local IP).
 * No DB access, no AI calls.
 */
export async function fetchSignals(): Promise<RawSignal[]> {
  console.log("Fetching signals from all sources...");
  const sourceNames = ["reddit", "stocktwits", "secInsider", "optionsFlow", "volumeSpike", "twitter", "congress"] as const;
  const sourceResults = await Promise.allSettled([
    fetchRedditSignals(),
    fetchStockTwitsSignals(),
    fetchSecInsiderSignals(),
    fetchOptionsFlowSignals(),
    fetchVolumeSpikeSignals(),
    fetchTwitterSignals(),
    fetchCongressSignals(),
  ]);

  sourceResults.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[harvest] Source "${sourceNames[i]}" threw an unexpected error:`, r.reason);
    }
  });

  const allSignals: RawSignal[] = sourceResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  console.log(`Total raw signals: ${allSignals.length}`);
  return allSignals;
}

/** Extract txId values from CONGRESS signal URLs. */
export function extractTxIdsFromUrls(urls: string[]): Set<string> {
  const txIds = new Set<string>();
  for (const url of urls) {
    const match = url.match(/txId=(\d+)/);
    if (match) txIds.add(match[1]);
  }
  return txIds;
}

/** Remove CONGRESS signals whose txId is already in seenTxIds. Non-CONGRESS signals pass through. */
export function deduplicateCongressSignals(signals: RawSignal[], seenTxIds: Set<string>): RawSignal[] {
  if (seenTxIds.size === 0) return signals;

  const beforeCount = signals.length;
  const filtered = signals.filter((s) => {
    if (s.source !== "CONGRESS" || !s.url) return true;
    const match = s.url.match(/txId=(\d+)/);
    return !match || !seenTxIds.has(match[1]);
  });

  const deduped = beforeCount - filtered.length;
  if (deduped > 0) {
    console.log(`Congress dedup: removed ${deduped} already-seen transaction(s)`);
  }
  return filtered;
}

/**
 * Process pre-fetched signals: aggregate, score, filter P&D, generate reports, write to DB.
 * This is the heavy work that can run on Cloud Run.
 */
export async function processSignals(allSignals: RawSignal[]): Promise<string> {
  console.log("Processing signals...");
  resetCostTracker();

  const devPrisma = createDevPrismaClient();
  if (devPrisma) {
    console.log("[dev-db] Dev database mirroring enabled");
  }

  // Clean up stale RUNNING scans from previous crashed runs (older than 1 hour)
  const staleCount = await prisma.scan.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    data: { status: "FAILED", error: "Abandoned — process crash" },
  });
  if (staleCount.count > 0) {
    console.warn(`[cleanup] Marked ${staleCount.count} stale RUNNING scan(s) as FAILED`);
  }

  // 1. Create Scan record
  const scan = await prisma.scan.create({
    data: { status: "RUNNING" },
  });

  await mirrorToDevDb(devPrisma, "scan create", async (client) => {
    await client.scan.create({ data: { id: scan.id, status: "RUNNING" } });
  });

  try {
    // Deduplicate CONGRESS signals against recent scans (same trade appears on Capitol Trades for days).
    const congressSignals = allSignals.filter((s) => s.source === "CONGRESS");
    if (congressSignals.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCongressUrls = await prisma.signal.findMany({
        where: {
          source: "CONGRESS",
          createdAt: { gte: sevenDaysAgo },
          url: { not: null },
        },
        select: { url: true },
      });

      const seenTxIds = extractTxIdsFromUrls(recentCongressUrls.map((r) => r.url).filter(Boolean) as string[]);
      allSignals = deduplicateCongressSignals(allSignals, seenTxIds);
    }

    console.log(`Total raw signals: ${allSignals.length}`);

    // 3. Aggregate by symbol
    const aggregated = aggregateSignals(allSignals);
    console.log(`Unique symbols: ${aggregated.length}`);

    // Filter to symbols with at least 2 signals, multi-source, or high-value single source
    const candidates = aggregated.filter(
      (a) => a.signals.length >= 2 || a.sourceCount >= 2 || a.weightedSourceScore >= 2
    );
    const nonCandidateAggregated = aggregated.filter(
      (a) => a.signals.length < 2 && a.sourceCount < 2 && a.weightedSourceScore < 2
    );
    console.log(`Candidates after filtering: ${candidates.length}, non-candidates: ${nonCandidateAggregated.length}`);

    // 4. Fetch fundamentals + novelty for ALL symbols (YF quote is free and batched)
    const allSymbols = aggregated.map((c) => c.symbol);
    const [fundamentalsMap, noveltyMap] = await Promise.all([
      fetchFundamentals(allSymbols),
      lookupNovelty(allSymbols, scan.id),
    ]);
    const novelCount = [...noveltyMap.values()].filter((n) => n.isNovel).length;
    console.log(`Novelty: ${novelCount} novel, ${aggregated.length - novelCount} recurring`);

    // 5. Drop candidates with no Yahoo Finance price — these are not real tradeable securities
    const validCandidates = candidates.filter((c) => {
      const fund = fundamentalsMap.get(c.symbol);
      return fund != null && fund.price != null;
    });
    const droppedCount = candidates.length - validCandidates.length;
    if (droppedCount > 0) {
      console.log(`[harvest] Dropped ${droppedCount} candidates with no YF price (not real securities)`);
    }

    // Non-candidates with YF price → UNSCORED stage (for backtesting data)
    const pricedNonCandidates = nonCandidateAggregated.filter((c) => {
      const fund = fundamentalsMap.get(c.symbol);
      return fund != null && fund.price != null;
    });
    console.log(`[harvest] ${pricedNonCandidates.length} non-candidates with YF price → UNSCORED`);

    // 6. AI scoring in batches of 15 (parallelized)
    const scoreBatches: AggregatedSymbol[][] = [];
    for (let i = 0; i < validCandidates.length; i += 15) {
      scoreBatches.push(validCandidates.slice(i, i + 15));
    }
    const scoreResults = (
      await Promise.all(
        scoreBatches.map((batch) => scoreSymbolBatch(batch, fundamentalsMap, noveltyMap))
      )
    ).flat();

    const scoreMap = new Map(scoreResults.map((s) => [s.symbol, s]));

    // 6. P&D filter + AI assessment for borderline
    let filteredCount = 0;
    const validatedResults: Array<{
      agg: AggregatedSymbol;
      score: number;
      sentiment: string;
      pndFlagged: boolean;
      pndFlags: string[];
      pndScore: number;
      stage: "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" | "UNSCORED";
      signalType: SignalType;
      rawAiScore?: number;
      pndAiConfidence?: number;
      pndAiReasoning?: string;
    }> = [];

    for (const agg of validCandidates) {
      const fundamentals = fundamentalsMap.get(agg.symbol) || null;
      const pnd = checkPndFlags(agg, fundamentals);

      // AI assessment for borderline cases (2 flags)
      let finalPndFlagged = pnd.flagged;
      let pndAiResult: PndAiResult | undefined;
      if (pnd.score === 2) {
        try {
          pndAiResult = await aiPndAssessment(agg.symbol, agg, pnd.flags);
          finalPndFlagged = pndAiResult.flagged;
        } catch (err) {
          console.warn(`[pnd] AI assessment failed for ${agg.symbol}, defaulting to flagged:`, err);
          finalPndFlagged = true; // conservative default
        }
      }

      if (finalPndFlagged) filteredCount++;

      const aiScore = scoreMap.get(agg.symbol);
      const score = aiScore?.score ?? 30;
      const sentiment = aiScore?.sentiment ?? "neutral";
      const novelty = noveltyMap.get(agg.symbol);
      const sources = new Set(agg.signals.map((s) => s.source));
      const hasNonSocialSource = sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("VOLUME_SPIKE") || sources.has("CONGRESS");
      const pctFrom52wkLow = parsePctFrom52wkLow(fundamentals?.price, fundamentals?.wk52Lo, fundamentals?.fiftyTwoWeekRange);
      const wk52Lo = fundamentals?.wk52Lo ?? undefined;
      const isAmexPenny = !!(
        fundamentals?.exchange?.toLowerCase().includes("american") &&
        fundamentals.price != null && fundamentals.price < 5
      );
      const isNasdaqSmallPenny = !!(
        fundamentals?.exchange &&
        (fundamentals.exchange.toLowerCase().includes("nasdaqcm") ||
         fundamentals.exchange.toLowerCase().includes("nasdaq capital") ||
         fundamentals.exchange.toLowerCase().includes("nasdaqgm") ||
         fundamentals.exchange.toLowerCase().includes("nasdaq global market")) &&
        fundamentals.price != null && fundamentals.price < 5
      );
      const stage = determineStage(score, agg.sourceCount, agg.weightedSourceScore, agg.avgVelocity, finalPndFlagged, hasNonSocialSource, novelty, agg.subredditCount, pctFrom52wkLow, wk52Lo, isAmexPenny, isNasdaqSmallPenny, agg.medianSignalAgeHrs);

      const signalType = classifySignalType(agg);

      validatedResults.push({
        agg,
        score,
        sentiment,
        pndFlagged: finalPndFlagged,
        pndFlags: pnd.flags,
        pndScore: pnd.score,
        stage,
        signalType,
        rawAiScore: scoreMap.get(agg.symbol)?.rawScore,
        pndAiConfidence: pndAiResult?.confidence,
        pndAiReasoning: pndAiResult?.reasoning,
      });
    }

    // 6b. Process non-candidates as UNSCORED (heuristic score only, no AI calls)
    const unscoredResults: typeof validatedResults = [];
    for (const agg of pricedNonCandidates) {
      const fundamentals = fundamentalsMap.get(agg.symbol) || null;
      const pnd = checkPndFlags(agg, fundamentals);
      const heuristic = defaultScore(agg, noveltyMap.get(agg.symbol));
      const signalType = classifySignalType(agg);

      unscoredResults.push({
        agg,
        score: heuristic.score,
        sentiment: heuristic.sentiment,
        pndFlagged: pnd.flagged,
        pndFlags: pnd.flags,
        pndScore: pnd.score,
        stage: "UNSCORED",
        signalType,
        rawAiScore: heuristic.rawScore,
      });
    }

    // Merge candidate + unscored results for DB write
    const allValidatedResults = [...validatedResults, ...unscoredResults];

    // 7. Generate AI reports for non-filtered tickers (top 20)
    const reportCandidates = validatedResults
      .filter((r) => !r.pndFlagged)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const reports = new Map<string, Awaited<ReturnType<typeof generateTickerReport>>>();
    const reportEntries = await Promise.allSettled(
      reportCandidates.map(async (r) => {
        const fundamentals = fundamentalsMap.get(r.agg.symbol) || null;
        const novelty = noveltyMap.get(r.agg.symbol);
        const report = await generateTickerReport(
          r.agg.symbol,
          r.agg,
          fundamentals,
          r.score,
          r.signalType,
          novelty
        );
        return { symbol: r.agg.symbol, report };
      })
    );
    for (const entry of reportEntries) {
      if (entry.status === "fulfilled") {
        reports.set(entry.value.symbol, entry.value.report);
      } else {
        console.warn(`[report] Generation failed:`, entry.reason);
      }
    }

    // 8. Store everything in database
    console.log("Storing results...");

    // Store ALL signals first (including single-mention symbols) with neutral defaults
    const allSignalData = allSignals.map((signal) => ({
      scanId: scan.id,
      symbol: signal.symbol,
      source: signal.source,
      title: signal.title,
      body: signal.body,
      url: signal.url,
      author: signal.author,
      authorAge: signal.authorAge,
      authorKarma: signal.authorKarma,
      upvotes: signal.upvotes,
      commentCount: signal.commentCount,
      velocityScore:
        signal.postAge != null && signal.sortType
          ? signal.sortType === "rising"
            ? 3
            : signal.sortType === "trending"
              ? 1.5
              : signal.sortType === "comment"
                ? 1.5
                : signal.postAge < 3
                  ? 2
                  : signal.postAge < 12
                    ? 1
                    : 0.5
          : 0,
      subreddit: signal.subreddit,
      postAge: signal.postAge,
      sortType: signal.sortType,
      purchaseValue: signal.purchaseValue,
      insiderTitle: signal.insiderTitle,
      volumeRatio: signal.volumeRatio,
      followerCount: signal.followerCount,
      retweetCount: signal.retweetCount,
      likeCount: signal.likeCount,
      tweetType: signal.tweetType,
      sentiment: "neutral", // Default for single-mention symbols
      pndFlagged: false,    // Default for single-mention symbols
      pndFlags: [],         // Default for single-mention symbols
      pndScore: 0,          // Default for single-mention symbols
    }));

    // Store validated tickers (candidates + UNSCORED non-candidates)
    const tickerDataList = allValidatedResults.map((result) => {
      const fundamentals = fundamentalsMap.get(result.agg.symbol);
      const report = reports.get(result.agg.symbol);
      const novelty = noveltyMap.get(result.agg.symbol);
      return {
        scanId: scan.id,
        symbol: result.agg.symbol,
        price: fundamentals?.price,
        marketCap: fundamentals?.marketCap,
        shortFloat: fundamentals?.shortFloat,
        fiftyTwoWkRange: fundamentals?.fiftyTwoWeekRange,
        wk52Lo: fundamentals?.wk52Lo ?? null,
        wk52Hi: fundamentals?.wk52Hi ?? null,
        exchange: fundamentals?.exchange,
        catalyst: report?.catalyst,
        risks: report?.risks,
        recommendation: report?.recommendation,
        report: report?.report,
        aiScore: result.score,
        stage: result.stage,
        signalCount: result.agg.signals.length,
        sourceCount: result.agg.sourceCount,
        avgSentiment:
          result.sentiment === "bullish" ? 0.7 : result.sentiment === "bearish" ? 0.3 : 0.5,
        signalType: result.signalType,
        firstSeenDaysAgo: novelty?.daysSinceFirstSeen ?? null,
        priorAppearances: novelty?.priorAppearances ?? 0,
        weightedSourceScore: result.agg.weightedSourceScore,
        avgVelocity: result.agg.avgVelocity,
        totalUpvotes: result.agg.totalUpvotes,
        totalComments: result.agg.totalComments,
        subredditCount: result.agg.subredditCount,
        risingCount: result.agg.momentum.risingCount,
        freshCount: result.agg.momentum.freshCount,
        recentCount: result.agg.momentum.recentCount,
        commentDerivedCount: result.agg.momentum.commentDerivedCount,
        staleCount: result.agg.momentum.staleCount,
        aiReasoning: scoreMap.get(result.agg.symbol)?.reasoning,
        sector: fundamentals?.sector,
        floatShares: fundamentals?.floatShares,
        name: fundamentals?.name,
        pndFlagged: result.pndFlagged,
        pndFlags: result.pndFlags,
        pndScore: result.pndScore,
        rawAiScore: result.rawAiScore,
        pndAiConfidence: result.pndAiConfidence,
        pndAiReasoning: result.pndAiReasoning,
        medianSignalAgeHrs: result.agg.medianSignalAgeHrs,
      };
    });

    const signalCount = allSignals.length;

    const aiCost = getTotalCost();

    const scanUpdateData = {
      status: "COMPLETED" as const,
      completedAt: new Date(),
      signalCount,
      validatedCount: validatedResults.filter((r) => !r.pndFlagged).length,
      filteredCount,
      aiCost,
    };

    // Wrap all writes in a transaction — if any step fails, nothing is committed
    // Increase timeout for large signal batches (default 5s is too short for 500+ signals)
    await prisma.$transaction(
      async (tx) => {
      // Store all signals first (including single-mention symbols)
      await tx.signal.createMany({ data: allSignalData });

      // Batch signal updates: group by identical values to minimize round-trips
      const updateGroups = new Map<string, string[]>();
      for (const result of allValidatedResults) {
        const key = JSON.stringify({
          sentiment: result.sentiment,
          pndFlagged: result.pndFlagged,
          pndFlags: result.pndFlags,
          pndScore: result.pndScore,
        });
        const symbols = updateGroups.get(key) ?? [];
        symbols.push(result.agg.symbol);
        updateGroups.set(key, symbols);
      }
      for (const [keyStr, symbols] of updateGroups) {
        const data = JSON.parse(keyStr);
        await tx.signal.updateMany({
          where: { scanId: scan.id, symbol: { in: symbols } },
          data,
        });
      }

      await tx.validatedTicker.createMany({ data: tickerDataList, skipDuplicates: true });
      await tx.scan.update({ where: { id: scan.id }, data: scanUpdateData });
    },
      { timeout: 30000 }
    );

    await mirrorToDevDb(devPrisma, "signals", async (client) => {
      // Store all signals first (including single-mention symbols)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.signal.createMany({ data: allSignalData as any });

      // Update all signals per symbol in one query (instead of per-signal)
      for (const result of allValidatedResults) {
        await client.signal.updateMany({
          where: { scanId: scan.id, symbol: result.agg.symbol },
          data: {
            sentiment: result.sentiment,
            pndFlagged: result.pndFlagged,
            pndFlags: result.pndFlags,
            pndScore: result.pndScore,
          },
        });
      }
    });

    await mirrorToDevDb(devPrisma, "validated tickers", async (client) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.validatedTicker.createMany({ data: tickerDataList as any, skipDuplicates: true });
    });

    await mirrorToDevDb(devPrisma, "scan complete", async (client) => {
      await client.scan.update({ where: { id: scan.id }, data: scanUpdateData });
    });

    console.log(
      `Scan ${scan.id} completed: ${signalCount} signals, ${scanUpdateData.validatedCount} validated, ${filteredCount} filtered`
    );

    return scan.id;
  } catch (err) {
    console.error("Scan failed:", err);
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });

    await mirrorToDevDb(devPrisma, "scan failed", async (client) => {
      await client.scan.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      });
    });

    throw err;
  } finally {
    if (devPrisma) {
      await devPrisma.$disconnect().catch(() => {});
    }
  }
}