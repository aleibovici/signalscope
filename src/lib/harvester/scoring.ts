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
- A high-velocity social signal with real engagement (high upvotes, comments) can reach 45-49 without a confirmed catalyst — it may be the FIRST signal before institutional confirmation arrives, but social alone NEVER exceeds 50.

Signal novelty (check isNovel, daysSinceFirstSeen, priorAppearances fields):
- Novel tickers (first appearance, isNovel=true): apply +5 to +10 boost — potential early signals before consensus.
- 1-2 prior appearances in last few days: no penalty, signal is still forming.
- 3+ appearances or 7+ days old: apply -5 to -15 staleness penalty — signal may be played out.
- Exception: a stale ticker with a NEW catalyst type (e.g. insider buy appearing for first time on a previously social-only ticker) should NOT be penalized.

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
      return {
        symbol: s.symbol,
        score: Math.min(100, Math.max(0, Math.round(item.score))),
        sentiment: item.sentiment,
        reasoning: typeof item.reasoning === "string" ? item.reasoning : "",
      };
    });
  } catch (err) {
    console.error("AI scoring error:", err);
    return symbols.map((s) => defaultScore(s, noveltyMap?.get(s.symbol)));
  }
}

function defaultScore(s: AggregatedSymbol, novelty?: NoveltyContext): AiScoreResult {
  const sources = new Set(s.signals.map((sig) => sig.source));
  const hasInsider = sources.has("SEC_INSIDER");
  const hasOptions = sources.has("OPTIONS_FLOW");
  const hasCatalystSource = hasInsider || hasOptions;

  // Insider/options signals get a strong base; pure social caps at 50
  let base: number;
  if (hasCatalystSource && s.sourceCount >= 3) {
    base = 65; // multi-source with real catalyst
  } else if (hasInsider) {
    base = 55; // insider buy alone is a strong signal
  } else if (hasOptions) {
    base = 50; // unusual options alone
  } else {
    base = Math.min(s.sourceCount * 15, 40); // social-only, capped low
  }

  const engagement = Math.min(Math.log2(s.totalUpvotes + s.totalComments + 1) * 1.5, 10);
  const velocityBoost = Math.min(s.avgVelocity * 3, 10);

  // Novelty adjustment: +5 for novel, -10 for stale
  let noveltyAdj = 0;
  if (novelty?.isNovel) {
    noveltyAdj = 5;
  } else if (novelty && (novelty.priorAppearances >= 3 || (novelty.daysSinceFirstSeen != null && novelty.daysSinceFirstSeen >= 7))) {
    noveltyAdj = -10;
  }

  const raw = base + engagement + velocityBoost + noveltyAdj;
  const score = Math.min(Math.round(raw), hasCatalystSource ? 100 : 50);

  return {
    symbol: s.symbol,
    score,
    sentiment: "neutral",
    reasoning: hasCatalystSource
      ? "Heuristic fallback — catalyst source detected"
      : "Heuristic fallback — social-only, low confidence",
  };
}
