import { chatJSON } from "@/lib/ai";
import type { AggregatedSymbol, AiScoreResult, FundamentalData } from "./types";

export async function scoreSymbolBatch(
  symbols: AggregatedSymbol[],
  fundamentalsMap?: Map<string, FundamentalData>
): Promise<AiScoreResult[]> {
  if (symbols.length === 0) return [];

  const symbolSummaries = symbols.map((s) => {
    const fundamentals = fundamentalsMap?.get(s.symbol);
    return {
      symbol: s.symbol,
      sourceCount: s.sourceCount,
      subredditCount: s.subredditCount,
      signalCount: s.signals.length,
      totalUpvotes: s.totalUpvotes,
      totalComments: s.totalComments,
      avgVelocity: s.avgVelocity,
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
- 40-59: Social buzz with some catalyst indicators but not confirmed — high velocity + strong engagement can push toward 55-59
- 20-39: Social-only signal, no verifiable catalyst
- 0-19: Likely noise or pump attempt

Also consider:
- Short float % — high short interest + real catalyst = squeeze candidate
- Price relative to 52-week range
- Exchange quality — NYSE/NASDAQ preferred over OTC
- Pre-consensus (first appearance) vs already widely discussed
- avgVelocity measures signal momentum: 3 = trending/rising, 2 = very fresh (<3h), 1 = recent (<12h), 0.5 = older.
  High velocity (≥2.0) with multiple mentions = potential early breakout. Weight this as a positive signal.
- A high-velocity social signal with real engagement (high upvotes, comments) deserves 50-59 even without a confirmed catalyst — it may be the FIRST signal before institutional confirmation arrives.

Return JSON: { "scores": [{ "symbol": "X", "score": 0-100, "sentiment": "bullish|bearish|neutral", "reasoning": "brief — state confidence level and what the score is based on" }] }`,
      userMessage: JSON.stringify(symbolSummaries),
    });

    const parsed = JSON.parse(response.content) as { scores: AiScoreResult[] };
    return parsed.scores || symbols.map(defaultScore);
  } catch (err) {
    console.error("AI scoring error:", err);
    return symbols.map(defaultScore);
  }
}

function defaultScore(s: AggregatedSymbol): AiScoreResult {
  const sources = new Set(s.signals.map((sig) => sig.source));
  const hasInsider = sources.has("SEC_INSIDER");
  const hasOptions = sources.has("OPTIONS_FLOW");
  const hasCatalystSource = hasInsider || hasOptions;

  // Insider/options signals get a strong base; pure social caps at 55
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
  const score = Math.min(Math.round(base + engagement + velocityBoost), hasCatalystSource ? 100 : 55);

  return {
    symbol: s.symbol,
    score,
    sentiment: "neutral",
    reasoning: hasCatalystSource
      ? "Heuristic fallback — catalyst source detected"
      : "Heuristic fallback — social-only, low confidence",
  };
}
