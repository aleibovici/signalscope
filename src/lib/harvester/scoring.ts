import { chatJSON } from "@/lib/ai";
import type { AggregatedSymbol, AiScoreResult, FundamentalData, NoveltyContext } from "./types";

export async function scoreSymbolBatch(
  symbols: AggregatedSymbol[],
  fundamentalsMap?: Map<string, FundamentalData>,
  noveltyMap?: Map<string, NoveltyContext>
): Promise<AiScoreResult[]> {
  if (symbols.length === 0) return [];

  const symbolSummaries = symbols.map((s) => {
    const fundamentals = fundamentalsMap?.get(s.symbol);
    const novelty = noveltyMap?.get(s.symbol);
    return {
      symbol: s.symbol,
      sourceCount: s.sourceCount,
      subredditCount: s.subredditCount,
      signalCount: s.signals.length,
      totalUpvotes: s.totalUpvotes,
      totalComments: s.totalComments,
      avgVelocity: s.avgVelocity,
      momentum: s.momentum,
      sampleTitles: s.signals
        .slice(0, 3)
        .map((sig) => sig.title)
        .filter(Boolean),
      sources: [...new Set(s.signals.map((sig) => sig.source))],
      ...(fundamentals
        ? {
            price: fundamentals.price,
            marketCap: fundamentals.marketCap,
            shortFloat: fundamentals.shortFloat,
            exchange: fundamentals.exchange,
            fiftyTwoWeekRange: fundamentals.fiftyTwoWeekRange,
          }
        : {}),
      ...(novelty
        ? {
            isNovel: novelty.isNovel,
            daysSinceFirstSeen: novelty.daysSinceFirstSeen,
            priorAppearances: novelty.priorAppearances,
          }
        : {}),
      medianSignalAgeHrs: s.medianSignalAgeHrs,
    };
  });

  try {
    const response = await chatJSON({
      callPoint: "scoring",
      tier: "mini",
      temperature: 0.3,
      systemPrompt: `You are a stock signal analyst. Score each symbol from 0-100 based on breakout potential.

HARD RULES:
- Tickers with REAL catalysts (SEC filings, earnings, FDA, partnerships, contracts, insider buys, unusual options flow) ALWAYS score higher than pure social media signals.
- A ticker with only Reddit/StockTwits mentions and no verifiable catalyst should NEVER score above 50.
- If an insider buy (Form 4 open market purchase) or unusual options activity exists, that is the strongest signal — weight it heavily.
- Be direct about confidence level. If evidence is thin or speculative, score low and say so. Do NOT hype weak signals.
- A low score is not a failure — it's honest. Most signals are noise.

Scoring guidance:
- 80-100: Real catalyst + multi-source corroboration + insider/options confirmation
- 60-79: Real catalyst + at least 2 sources, or strong insider/options signal alone
- 40-49: Social buzz with some catalyst indicators but not confirmed — high velocity + strong engagement can push toward 45-49 but NEVER above 50 without a verifiable catalyst
- 20-39: Social-only signal, no verifiable catalyst
- 0-19: Likely noise or pump attempt

Also consider:
- Short float % — high short interest + real catalyst = squeeze candidate
- Price relative to 52-week range
- Exchange quality — NYSE/NASDAQ preferred over OTC
- Pre-consensus (first appearance) vs already widely discussed
- avgVelocity measures signal momentum: 3 = trending/rising, 2 = very fresh (<3h), 1 = recent (<12h), 0.5 = older.
  High velocity (≥2.0) with multiple mentions = potential early breakout. Weight this as a positive signal.
- momentum breakdown (risingCount, freshCount, recentCount, commentDerivedCount, staleCount) shows the composition behind avgVelocity.
  Multiple rising signals = strong trending evidence. commentDerivedCount > 0 means organic discussion (tickers mentioned in comments, not just post titles). High staleCount dilutes the signal.
- subredditCount = number of unique subreddits mentioning the ticker. 3+ subreddits = broad consensus across communities (stronger signal, +3-5 boost). 1 subreddit = possible echo chamber (weaker).
- High upvote-to-comment ratio (>5:1) with significant upvotes (>100) suggests strong conviction — apply +5 to +8 boost.
- CRITICAL: High comment count alone is NOT positive engagement — ML shows it predicts worse 7d returns (SHAP -0.004). When totalComments > 150 with ratio < 2:1, this is peak hype — apply -8 to -10 penalty, signal is likely already played out.
- reddit_velocity is the strongest source-level predictor. Weight high-velocity Reddit signals (avgVelocity >= 2.5) as +3 to +5.
- A high-velocity social signal with real engagement (high upvotes, comments) can reach 45-49 without a confirmed catalyst — it may be the FIRST signal before institutional confirmation arrives, but social alone NEVER exceeds 50.

Signal age (medianSignalAgeHrs field — median age of social signals in hours):
- medianSignalAgeHrs < 3: Fresh signals — potential early breakout, no penalty.
- medianSignalAgeHrs 3-6: Moderately fresh — no penalty but note the move may have started.
- medianSignalAgeHrs 6-12: Stale signals — apply -3 to -5 penalty. Price has likely already moved.
- medianSignalAgeHrs > 12: Very stale — apply -5 to -10 penalty. By the time signals are this old, the initial momentum is exhausted and you're buying at or near the top.
- null: Non-social signals (insider, congress) — no age penalty, these are filed disclosures.

Signal novelty (check isNovel, daysSinceFirstSeen, priorAppearances fields):
- Novel tickers (first appearance, isNovel=true): apply +3 to +5 boost — potential early signal, but unproven.
- daysSinceFirstSeen 3-5 days: SWEET SPOT — apply +5 to +8 boost. ML shows tickers validated over 3+ days have the best near-term returns. The signal has proven staying power.
- 1-2 prior appearances in last few days: no penalty, signal is still forming.
- 3+ appearances or 7+ days old: apply -5 to -15 staleness penalty — signal may be played out.
- Exception: a stale ticker with a NEW catalyst type (e.g. insider buy appearing for first time on a previously social-only ticker) should NOT be penalized.

Price quality (check price field):
- price < $0.12: heavy penalty (-10 to -15). Sub-dime stocks almost never generate positive returns at any horizon. Score should rarely exceed 20 without an exceptional catalyst.
- price $0.12-$0.50: mild penalty (-3 to -5). Low-priced stocks need stronger evidence.
- price > $0.52: no price penalty. ML shows this is the threshold for reliable 7d follow-through.

Reddit comment engagement (check totalComments field):
- totalComments 30-100: moderate positive signal (+3 to +5) — genuine discussion indicates organic interest, especially for 3d returns.
- totalComments > 150 with low upvote ratio: still apply the peak hype penalty as described above.

Return JSON: { "scores": [{ "symbol": "X", "score": 0-100, "sentiment": "bullish|bearish|neutral", "reasoning": "brief — state confidence level and what the score is based on" }] }`,
      userMessage: JSON.stringify(symbolSummaries),
    });

    const parsed = JSON.parse(response.content);
    const rawScores = Array.isArray(parsed?.scores) ? parsed.scores : null;
    if (!rawScores) {
      console.warn("AI scoring returned unexpected structure, using heuristic fallback");
      return symbols.map((s) => defaultScore(s, noveltyMap?.get(s.symbol)));
    }

    // Map back to input symbols — use heuristic fallback for any missing/malformed entries
    return symbols.map((s) => {
      const item = rawScores.find(
        (r: unknown) =>
          typeof r === "object" && r !== null && (r as Record<string, unknown>).symbol === s.symbol
      ) as AiScoreResult | undefined;
      if (!item || typeof item.score !== "number" || typeof item.sentiment !== "string") {
        return defaultScore(s, noveltyMap?.get(s.symbol));
      }

      // Enforce social-only cap: tickers without a catalyst source (SEC_INSIDER/OPTIONS_FLOW/CONGRESS)
      // should never score above 50, regardless of what the AI returns
      const sources = new Set(s.signals.map((sig) => sig.source));
      const hasCatalystSource = sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("CONGRESS");
      const maxScore = hasCatalystSource ? 100 : 50;

      const rawScore = Math.max(0, Math.round(item.score));
      return {
        symbol: s.symbol,
        score: Math.min(maxScore, rawScore),
        rawScore,
        sentiment: item.sentiment,
        reasoning: typeof item.reasoning === "string" ? item.reasoning : "",
      };
    });
  } catch (err) {
    console.error("AI scoring error:", err);
    return symbols.map((s) => defaultScore(s, noveltyMap?.get(s.symbol)));
  }
}

export function defaultScore(s: AggregatedSymbol, novelty?: NoveltyContext): AiScoreResult {
  const sources = new Set(s.signals.map((sig) => sig.source));
  const hasInsider = sources.has("SEC_INSIDER");
  const hasOptions = sources.has("OPTIONS_FLOW");
  const hasCongress = sources.has("CONGRESS");
  const hasCatalystSource = hasInsider || hasOptions || hasCongress;

  // Insider/options/congress signals get a strong base; pure social caps at 50
  let base: number;
  if (hasCatalystSource && s.sourceCount >= 3) {
    base = 65; // multi-source with real catalyst
  } else if (hasInsider) {
    base = 55; // insider buy alone is a strong signal
  } else if (hasCongress) {
    base = 52; // congressional buy — strong signal, slightly below insider
  } else if (hasOptions) {
    base = 50; // unusual options alone
  } else {
    base = Math.min(s.sourceCount * 15, 40); // social-only, capped low
  }

  const engagement = Math.min(Math.log2(s.totalUpvotes + 1) * 2.0, 10);
  const velocityBoost = Math.min(s.avgVelocity * 3, 10);

  // Comment-heavy penalty: high comments with low upvote ratio = peak hype (ML: comments negatively predict 7d returns)
  let commentAdj = 0;
  if (s.totalComments > 150 && s.totalUpvotes / (s.totalComments || 1) < 2) {
    commentAdj = -5;
  } else if (s.totalUpvotes > 100 && s.totalUpvotes / (s.totalComments || 1) > 5) {
    commentAdj = 3;
  }

  // Novelty adjustment: +5 for novel, -10 for stale
  let noveltyAdj = 0;
  if (novelty?.isNovel) {
    noveltyAdj = 5;
  } else if (novelty && (novelty.priorAppearances >= 3 || (novelty.daysSinceFirstSeen != null && novelty.daysSinceFirstSeen >= 7))) {
    noveltyAdj = -10;
  }

  // Signal age penalty: stale signals have already moved, penalize late detection
  let stalenessAdj = 0;
  if (s.medianSignalAgeHrs != null) {
    if (s.medianSignalAgeHrs > 12) stalenessAdj = -8;
    else if (s.medianSignalAgeHrs > 6) stalenessAdj = -4;
  }

  const raw = base + engagement + velocityBoost + noveltyAdj + stalenessAdj + commentAdj;
  const rawScore = Math.round(raw);
  const score = Math.min(rawScore, hasCatalystSource ? 100 : 50);

  return {
    symbol: s.symbol,
    score,
    rawScore,
    sentiment: "neutral",
    reasoning: hasCatalystSource
      ? "Heuristic fallback — catalyst source detected"
      : "Heuristic fallback — social-only, low confidence",
  };
}
