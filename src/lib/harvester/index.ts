import { prisma } from "@/lib/prisma";
import type { AggregatedSymbol, RawSignal, SignalType } from "./types";
import { fetchRedditSignals } from "./sources/reddit";
import { fetchStockTwitsSignals } from "./sources/stocktwits";
import { fetchSecInsiderSignals } from "./sources/sec-insider";
import { fetchOptionsFlowSignals } from "./sources/options-flow";
import { fetchVolumeSpikeSignals } from "./sources/volume-spike";
import { scoreSymbolBatch } from "./scoring";
import { checkPndFlags, aiPndAssessment } from "./pnd-filter";
import { fetchFundamentals } from "./fundamentals";
import { generateTickerReport } from "./report";
import { resetCostTracker, getTotalCost } from "@/lib/ai";

function aggregateSignals(signals: RawSignal[]): AggregatedSymbol[] {
  const bySymbol = new Map<string, RawSignal[]>();

  for (const signal of signals) {
    const existing = bySymbol.get(signal.symbol) || [];
    existing.push(signal);
    bySymbol.set(signal.symbol, existing);
  }

  return [...bySymbol.entries()]
    .map(([symbol, sigs]) => ({
      symbol,
      signals: sigs,
      sourceCount: new Set(sigs.map((s) =>
        s.source === "REDDIT" && s.subreddit ? `REDDIT:${s.subreddit}` : s.source
      )).size,
      totalUpvotes: sigs.reduce((sum, s) => sum + (s.upvotes || 0), 0),
      totalComments: sigs.reduce((sum, s) => sum + (s.commentCount || 0), 0),
      avgVelocity: sigs.reduce((sum, s) => {
        if (s.postAge != null && s.sortType) {
          const sort = s.sortType as "new" | "rising";
          if (sort === "rising") return sum + 3;
          if (s.postAge < 3) return sum + 2;
          if (s.postAge < 12) return sum + 1;
          return sum + 0.5;
        }
        return sum;
      }, 0) / (sigs.length || 1),
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount || b.signals.length - a.signals.length);
}

function determineStage(
  aiScore: number,
  sourceCount: number,
  pndFlagged: boolean
): "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" {
  if (pndFlagged) return "FILTERED";
  if (aiScore >= 70 && sourceCount >= 3) return "CONFIRMED";
  if (aiScore >= 50 && sourceCount >= 2) return "FORMING";
  return "EARLY";
}

function classifySignalType(agg: AggregatedSymbol): SignalType {
  const sources = new Set(agg.signals.map((s) => s.source));
  const hasReddit = sources.has("REDDIT");
  const hasStockTwits = sources.has("STOCKTWITS");
  const hasInsider = sources.has("SEC_INSIDER");
  const hasOptions = sources.has("OPTIONS_FLOW");
  const hasVolume = sources.has("VOLUME_SPIKE");

  // Multi-source: Reddit + StockTwits + at least one of insider/options/volume
  if ((hasReddit || hasStockTwits) && (hasInsider || hasOptions || hasVolume) && sources.size >= 3) {
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

  // Reddit velocity: Reddit-only but with strong velocity
  return "reddit_velocity";
}

export async function orchestrateScan(): Promise<string> {
  console.log("Starting scan...");
  resetCostTracker();

  // 1. Create Scan record
  const scan = await prisma.scan.create({
    data: { status: "RUNNING" },
  });

  try {
    // 2. Fetch signals in parallel from all sources
    console.log("Fetching signals from all sources...");
    const [reddit, stocktwits, secInsider, optionsFlow, volumeSpike] =
      await Promise.allSettled([
        fetchRedditSignals(),
        fetchStockTwitsSignals(),
        fetchSecInsiderSignals(),
        fetchOptionsFlowSignals(),
        fetchVolumeSpikeSignals(),
      ]);

    const allSignals: RawSignal[] = [
      ...(reddit.status === "fulfilled" ? reddit.value : []),
      ...(stocktwits.status === "fulfilled" ? stocktwits.value : []),
      ...(secInsider.status === "fulfilled" ? secInsider.value : []),
      ...(optionsFlow.status === "fulfilled" ? optionsFlow.value : []),
      ...(volumeSpike.status === "fulfilled" ? volumeSpike.value : []),
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

    // 5. AI scoring in batches of 15 (with fundamentals context)
    const scoreResults = [];
    for (let i = 0; i < candidates.length; i += 15) {
      const batch = candidates.slice(i, i + 15);
      const scores = await scoreSymbolBatch(batch, fundamentalsMap);
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
      const stage = determineStage(score, agg.sourceCount, finalPndFlagged);

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
      const report = await generateTickerReport(
        r.agg.symbol,
        r.agg,
        fundamentals,
        r.score,
        r.signalType
      );
      reports.set(r.agg.symbol, report);
    }

    // 8. Store everything in database
    console.log("Storing results...");

    // Store signals
    for (const result of validatedResults) {
      for (const signal of result.agg.signals) {
        await prisma.signal.create({
          data: {
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
            velocityScore: (signal.postAge != null && signal.sortType)
              ? (signal.sortType === "rising" ? 3 : signal.postAge < 3 ? 2 : signal.postAge < 12 ? 1 : 0.5)
              : 0,
            sentiment: result.sentiment,
            pndFlagged: result.pndFlagged,
            pndFlags: result.pndFlags,
            pndScore: result.pndScore,
          },
        });
      }
    }

    // Store validated tickers
    for (const result of validatedResults) {
      const fundamentals = fundamentalsMap.get(result.agg.symbol);
      const report = reports.get(result.agg.symbol);

      await prisma.validatedTicker.create({
        data: {
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
          avgSentiment: result.sentiment === "bullish" ? 0.7 : result.sentiment === "bearish" ? 0.3 : 0.5,
          signalType: result.signalType,
        },
      });
    }

    // Update scan record
    const signalCount = validatedResults.reduce(
      (sum, r) => sum + r.agg.signals.length,
      0
    );

    const aiCost = getTotalCost();

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        signalCount,
        validatedCount: validatedResults.filter((r) => !r.pndFlagged).length,
        filteredCount,
        aiCost,
      },
    });

    console.log(
      `Scan ${scan.id} completed: ${signalCount} signals, ${reportCandidates.length} validated, ${filteredCount} filtered`
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
    throw err;
  }
}
