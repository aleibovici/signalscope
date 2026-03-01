import { prisma, createDevPrismaClient } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AggregatedSymbol, NoveltyContext, RawSignal, SignalType } from "./types";
import { fetchRedditSignals } from "./sources/reddit";
import { fetchStockTwitsSignals } from "./sources/stocktwits";
import { fetchSecInsiderSignals } from "./sources/sec-insider";
import { fetchOptionsFlowSignals } from "./sources/options-flow";
import { fetchVolumeSpikeSignals } from "./sources/volume-spike";
import { fetchTwitterSignals } from "./sources/twitter";
import { scoreSymbolBatch } from "./scoring";
import { checkPndFlags, aiPndAssessment } from "./pnd-filter";
import { fetchFundamentals } from "./fundamentals";
import { generateTickerReport } from "./report";
import { resetCostTracker, getTotalCost } from "@/lib/ai";

const SOURCE_WEIGHTS: Record<string, number> = {
  SEC_INSIDER: 3,
  OPTIONS_FLOW: 2.5,
  VOLUME_SPIKE: 2,
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
        avgVelocity: sigs.reduce((sum, s) => {
          if (s.postAge != null && s.sortType) {
            if (s.sortType === "rising") return sum + 3;
            if (s.sortType === "comment") return sum + 1.5;
            if (s.postAge < 3) return sum + 2;
            if (s.postAge < 12) return sum + 1;
            return sum + 0.5;
          }
          return sum;
        }, 0) / (sigs.length || 1),
        momentum: sigs.reduce(
          (m, s) => {
            if (s.postAge != null && s.sortType) {
              if (s.sortType === "rising") m.risingCount++;
              else if (s.sortType === "comment") m.commentDerivedCount++;
              else if (s.postAge < 3) m.freshCount++;
              else if (s.postAge < 12) m.recentCount++;
              else m.staleCount++;
            }
            return m;
          },
          { risingCount: 0, freshCount: 0, recentCount: 0, commentDerivedCount: 0, staleCount: 0 }
        ),
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

function determineStage(
  aiScore: number,
  sourceCount: number,
  weightedSourceScore: number,
  avgVelocity: number,
  pndFlagged: boolean,
  hasNonSocialSource: boolean,
  novelty?: NoveltyContext
): "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" {
  if (pndFlagged) return "FILTERED";

  const effectiveScore = novelty?.isNovel ? aiScore + 5 : aiScore;

  if (hasNonSocialSource && effectiveScore >= 70 && sourceCount >= 3) return "CONFIRMED";
  if (hasNonSocialSource && effectiveScore >= 65 && weightedSourceScore >= 4) return "CONFIRMED";
  if (hasNonSocialSource && effectiveScore >= 65 && sourceCount >= 2 && avgVelocity >= 2.0) return "CONFIRMED";
  if (effectiveScore >= 50 && sourceCount >= 2) return "FORMING";
  if (effectiveScore >= 45 && avgVelocity >= 2.0) return "FORMING";

  // Novel tickers with decent score and multi-source get promoted
  if (novelty?.isNovel && aiScore >= 40 && sourceCount >= 2) return "FORMING";

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

  // Multi-source: social (Reddit/StockTwits/Twitter) + at least one of insider/options/volume
  if ((hasReddit || hasStockTwits || hasTwitter) && (hasInsider || hasOptions || hasVolume) && sources.size >= 3) {
    return "multi_source";
  }

  // Insider buy: has SEC insider signal (Form 4 open market purchase)
  if (hasInsider) {
    return "insider_buy";
  }

  // Options flow: unusual call sweep/volume
  if (hasOptions) {
    return "options_flow";
  }

  // Twitter velocity: Twitter-only signals
  if (hasTwitter && !hasReddit && !hasStockTwits) {
    return "twitter_velocity";
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

export async function orchestrateScan(): Promise<string> {
  console.log("Starting scan...");
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
    // 2. Fetch signals in parallel from all sources
    console.log("Fetching signals from all sources...");
    const [reddit, stocktwits, secInsider, optionsFlow, volumeSpike, twitter] =
      await Promise.allSettled([
        fetchRedditSignals(),
        fetchStockTwitsSignals(),
        fetchSecInsiderSignals(),
        fetchOptionsFlowSignals(),
        fetchVolumeSpikeSignals(),
        fetchTwitterSignals(),
      ]);

    const allSignals: RawSignal[] = [
      ...(reddit.status === "fulfilled" ? reddit.value : []),
      ...(stocktwits.status === "fulfilled" ? stocktwits.value : []),
      ...(secInsider.status === "fulfilled" ? secInsider.value : []),
      ...(optionsFlow.status === "fulfilled" ? optionsFlow.value : []),
      ...(volumeSpike.status === "fulfilled" ? volumeSpike.value : []),
      ...(twitter.status === "fulfilled" ? twitter.value : []),
    ];

    console.log(`Total raw signals: ${allSignals.length}`);

    // 3. Aggregate by symbol
    const aggregated = aggregateSignals(allSignals);
    console.log(`Unique symbols: ${aggregated.length}`);

    // Filter to symbols with at least 2 signals or multi-source
    const candidates = aggregated.filter(
      (a) => a.signals.length >= 2 || a.sourceCount >= 2
    );
    console.log(`Candidates after filtering: ${candidates.length}`);

    // 4. Fetch fundamentals for all candidates
    const fundamentalsMap = await fetchFundamentals(
      candidates.map((c) => c.symbol)
    );

    // 5. Novelty lookup (30-day window)
    const noveltyMap = await lookupNovelty(
      candidates.map((c) => c.symbol),
      scan.id
    );
    const novelCount = [...noveltyMap.values()].filter((n) => n.isNovel).length;
    console.log(`Novelty: ${novelCount} novel, ${candidates.length - novelCount} recurring`);

    // 6. AI scoring in batches of 15 (with fundamentals + novelty context)
    const scoreResults = [];
    for (let i = 0; i < candidates.length; i += 15) {
      const batch = candidates.slice(i, i + 15);
      const scores = await scoreSymbolBatch(batch, fundamentalsMap, noveltyMap);
      scoreResults.push(...scores);
    }

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
      stage: "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED";
      signalType: SignalType;
    }> = [];

    for (const agg of candidates) {
      const fundamentals = fundamentalsMap.get(agg.symbol) || null;
      const pnd = checkPndFlags(agg, fundamentals);

      // AI assessment for borderline cases (2 flags)
      let finalPndFlagged = pnd.flagged;
      if (pnd.score === 2) {
        finalPndFlagged = await aiPndAssessment(agg.symbol, agg, pnd.flags);
      }

      if (finalPndFlagged) filteredCount++;

      const aiScore = scoreMap.get(agg.symbol);
      const score = aiScore?.score ?? 30;
      const sentiment = aiScore?.sentiment ?? "neutral";
      const novelty = noveltyMap.get(agg.symbol);
      const sources = new Set(agg.signals.map((s) => s.source));
      const hasNonSocialSource = sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("VOLUME_SPIKE");
      const stage = determineStage(score, agg.sourceCount, agg.weightedSourceScore, agg.avgVelocity, finalPndFlagged, hasNonSocialSource, novelty);

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
      });
    }

    // 7. Generate AI reports for non-filtered tickers (top 20)
    const reportCandidates = validatedResults
      .filter((r) => !r.pndFlagged)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const reports = new Map<string, Awaited<ReturnType<typeof generateTickerReport>>>();
    for (const r of reportCandidates) {
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
      reports.set(r.agg.symbol, report);
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
            : signal.sortType === "comment"
              ? 1.5
              : signal.postAge < 3
                ? 2
                : signal.postAge < 12
                  ? 1
                  : 0.5
          : 0,
      sentiment: "neutral", // Default for single-mention symbols
      pndFlagged: false,    // Default for single-mention symbols
      pndFlags: [],         // Default for single-mention symbols
      pndScore: 0,          // Default for single-mention symbols
    }));

    // Store validated tickers
    const tickerDataList = validatedResults.map((result) => {
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
    await prisma.$transaction(async (tx) => {
      // Store all signals first (including single-mention symbols)
      await tx.signal.createMany({ data: allSignalData });

      // Update signals from validated candidates with proper AI scoring and P&D flags
      for (const result of validatedResults) {
        const symbolSignals = result.agg.signals;
        for (const signal of symbolSignals) {
          await tx.signal.updateMany({
            where: {
              scanId: scan.id,
              symbol: signal.symbol,
              source: signal.source,
              title: signal.title,
            },
            data: {
              sentiment: result.sentiment,
              pndFlagged: result.pndFlagged,
              pndFlags: result.pndFlags,
              pndScore: result.pndScore,
            },
          });
        }
      }

      await tx.validatedTicker.createMany({ data: tickerDataList, skipDuplicates: true });
      await tx.scan.update({ where: { id: scan.id }, data: scanUpdateData });
    });

    await mirrorToDevDb(devPrisma, "signals", async (client) => {
      // Store all signals first (including single-mention symbols)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.signal.createMany({ data: allSignalData as any });

      // Update signals from validated candidates with proper AI scoring and P&D flags
      for (const result of validatedResults) {
        const symbolSignals = result.agg.signals;
        for (const signal of symbolSignals) {
          await client.signal.updateMany({
            where: {
              scanId: scan.id,
              symbol: signal.symbol,
              source: signal.source,
              title: signal.title,
            },
            data: {
              sentiment: result.sentiment,
              pndFlagged: result.pndFlagged,
              pndFlags: result.pndFlags,
              pndScore: result.pndScore,
            },
          });
        }
      }
    });

    await mirrorToDevDb(devPrisma, "validated tickers", async (client) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.validatedTicker.createMany({ data: tickerDataList as any, skipDuplicates: true });
    });

    await mirrorToDevDb(devPrisma, "scan complete", async (client) => {
      await client.scan.update({ where: { id: scan.id }, data: scanUpdateData });
    });

    if (devPrisma) {
      await devPrisma.$disconnect().catch(() => {});
    }

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

    if (devPrisma) {
      await devPrisma.$disconnect().catch(() => {});
    }

    throw err;
  }
}
