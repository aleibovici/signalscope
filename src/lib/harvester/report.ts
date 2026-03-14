import { chatJSON } from "@/lib/ai";
import { chatReACT, validateTradeSetup } from "@/lib/ai/react";
import type { AggregatedSymbol, FundamentalData, NoveltyContext, SignalType, TickerReport } from "./types";

const CATALYST_SOURCES = new Set(["SEC_INSIDER", "SEC_FILING", "CONGRESS", "OPTIONS_FLOW", "VOLUME_SPIKE"]);

/** Pick up to `limit` sample signals, prioritizing catalyst sources so they aren't cut off */
function pickDiverseSample(signals: AggregatedSymbol["signals"], limit: number) {
  const catalyst = signals.filter((s) => CATALYST_SOURCES.has(s.source));
  const social = signals.filter((s) => !CATALYST_SOURCES.has(s.source));
  // Take all catalyst signals first (up to limit), fill remainder with social
  const picked = [...catalyst.slice(0, limit), ...social.slice(0, Math.max(0, limit - catalyst.length))];
  return picked.slice(0, limit);
}

/** Build the JSON context string shared by single-shot and ReACT report generation */
function buildTickerContext(
  symbol: string,
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  signalType?: SignalType,
  novelty?: NoveltyContext
): string {
  const uniqueSources = [...new Set(agg.signals.map((s) => s.source))];
  const hasCatalystSource = uniqueSources.some((s) => CATALYST_SOURCES.has(s));

  return JSON.stringify({
    symbol,
    signalType: signalType || "unknown",
    signalCount: agg.signals.length,
    sourceCount: agg.sourceCount,
    sources: uniqueSources,
    hasCatalystSource,
    subredditCount: agg.subredditCount,
    avgVelocity: agg.avgVelocity,
    aiScore,
    fundamentals: fundamentals
      ? {
          price: fundamentals.price,
          marketCap: fundamentals.marketCap,
          shortFloat: fundamentals.shortFloat,
          fiftyTwoWeekRange: fundamentals.fiftyTwoWeekRange,
          name: fundamentals.name,
          sector: fundamentals.sector,
          exchange: fundamentals.exchange,
        }
      : null,
    sampleSignals: pickDiverseSample(agg.signals, 5).map((s) => ({
      source: s.source,
      title: s.title,
      upvotes: s.upvotes,
      commentCount: s.commentCount,
      subreddit: s.subreddit,
      insiderTitle: s.insiderTitle,
      purchaseValue: s.purchaseValue,
      optionType: s.optionType,
      volOiRatio: s.volOiRatio,
    })),
    ...(novelty
      ? {
          novelty: {
            isNovel: novelty.isNovel,
            daysSinceFirstSeen: novelty.daysSinceFirstSeen,
            priorAppearances: novelty.priorAppearances,
          },
        }
      : {}),
  });
}

export const REPORT_SYSTEM_PROMPT = `You are a senior equity analyst. Generate a concise, honest breakout report for the given stock symbol.

HARD RULES:
- If an insider buy (Form 4) or unusual options activity exists, LEAD WITH THAT in the catalyst field. It is the most important signal.
- Prioritize REAL catalysts (SEC filings, earnings, FDA, partnerships, contracts) over social media buzz. If the only signal is Reddit/StockTwits chatter with no verifiable catalyst, say so directly.
- Be direct about confidence level. Do NOT hype weak signals. If evidence is thin, say "Low confidence — social signal only, no verifiable catalyst." A "Watch" or "Avoid" recommendation is fine and often correct.
- Never use vague hype language like "could be huge" or "massive potential." State what is known and what is speculation.

Catalyst field format:
- If insider_buy: "CEO/CFO [name] purchased $[amount] of stock on [date] — insider buying signals confidence in near-term outlook."
- If options_flow: "Unusual [call/put] activity detected — [volume] contracts vs [OI] open interest ([ratio]x), suggesting smart money positioning."
- If congress: "[Chamber] [Name] ([Party]) purchased ~$[amount] of [ticker] on [date] — congressional trading often precedes policy-driven moves."
- If multi_source: Lead with the strongest non-social signal (insider, congress, or options), then note cross-source corroboration.
- If reddit_velocity only: "Social signal only — [describe what's being discussed]. No insider or institutional confirmation yet."

Also analyze:
- Short squeeze potential: high short float % + real catalyst = squeeze candidate
- Price position relative to 52-week range
- Signal novelty: first appearance (novel) signals may represent early detection before consensus; recurring signals (3+ appearances) may be stale unless a new catalyst type has appeared
- Key risks and downside scenarios

Recommendation guidance:
- Strong Buy: Real catalyst + insider/options confirmation + multi-source. Rare.
- Buy: Real catalyst with at least 2 corroborating sources. Also appropriate for strong multi-source social consensus (3+ subreddits or cross-platform agreement) with high velocity and favorable fundamentals, even without an institutional catalyst.
- Watch: Interesting signal but needs more confirmation or catalyst is unverified. Single-source social signals without strong engagement belong here.
- Avoid: P&D risk indicators, deteriorating fundamentals, or single low-quality social mention with no engagement.

IMPORTANT: Check the "sources" array in the input — it shows ALL source types that contributed signals, not just the sample. A ticker with signals from 3+ sources or 3+ subreddits represents genuine cross-platform consensus, not mere hype. Do not dismiss multi-source social consensus as "pure social hype" — coordinated independent discovery across platforms is a meaningful signal. Reserve "Avoid" for genuinely weak setups (single source, low engagement, bad fundamentals, P&D flags), not for well-corroborated emerging signals.

Trade setup rules (ONLY for Buy or Strong Buy — omit tradeSetup entirely for Watch or Avoid):
- entryLo/entryHi: tight range around current price or a technical level (typically within 2-5% of current price)
- stopLoss: below key support, recent low, or 52-week low — never wider than 12% from entry midpoint
- target1: nearest resistance or 15-25% above entry midpoint
- target2: extended target if catalyst fully plays out (30-50% above entry)
- timeframe: realistic holding period given catalyst type (insider/congress: "1-3 weeks"; options flow: "3-7 days"; social only: "1-3 days")
- riskReward: must be at minimum "1:1.5" to recommend Buy; "1:2" or better for Strong Buy
- confidence: "High" = insider/congress + multi-source; "Medium" = real catalyst, fewer sources; "Low" = speculative setup
- All price fields must be numbers (not strings). Use the current price and 52-week range to derive realistic levels.
- If you cannot derive a technically sound setup, omit tradeSetup entirely even for Buy.

Return JSON:
{
  "catalyst": "1-2 sentence catalyst summary — lead with insider/options if present",
  "risks": "1-2 sentence key risks — be specific",
  "recommendation": "Strong Buy|Buy|Watch|Avoid",
  "report": "3-5 paragraph analysis covering catalyst, technical setup, short interest, risk factors, and outlook. State confidence level explicitly.",
  "tradeSetup": {
    "entryLo": <number>,
    "entryHi": <number>,
    "stopLoss": <number>,
    "target1": <number>,
    "target2": <number>,
    "timeframe": "<string>",
    "riskReward": "<string e.g. 1:2.5>",
    "confidence": "Low|Medium|High"
  }
}`;

export async function generateTickerReport(
  symbol: string,
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  signalType?: SignalType,
  novelty?: NoveltyContext
): Promise<TickerReport> {
  try {
    const response = await chatJSON({
      callPoint: "report",
      tier: "standard",
      temperature: 0.4,
      systemPrompt: REPORT_SYSTEM_PROMPT,
      userMessage: buildTickerContext(symbol, agg, fundamentals, aiScore, signalType, novelty),
    });

    const raw = JSON.parse(response.content);
    if (
      !raw ||
      typeof raw.catalyst !== "string" ||
      typeof raw.risks !== "string" ||
      typeof raw.recommendation !== "string" ||
      typeof raw.report !== "string"
    ) {
      console.warn(`Report for ${symbol} returned invalid structure, using default`);
      return defaultReport(symbol);
    }

    // Validate optional tradeSetup — drop silently if malformed
    if (raw.tradeSetup !== undefined && raw.tradeSetup !== null) {
      raw.tradeSetup = validateTradeSetup(raw.tradeSetup);
      if (!raw.tradeSetup) {
        console.warn(`Report for ${symbol} has invalid tradeSetup shape, dropping it`);
      }
    }

    return raw as TickerReport;
  } catch (err) {
    console.error(`Report generation for ${symbol} error:`, err);
    return defaultReport(symbol);
  }
}

export async function generateTickerReportReACT(
  symbol: string,
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  scanId: string,
  signalType?: SignalType,
  novelty?: NoveltyContext
): Promise<TickerReport> {
  try {
    return await chatReACT({
      symbol,
      scanId,
      initialContext: buildTickerContext(symbol, agg, fundamentals, aiScore, signalType, novelty),
      reportSystemPrompt: REPORT_SYSTEM_PROMPT,
      temperature: 0.4,
    });
  } catch (err) {
    console.warn(`[react] ReACT failed for ${symbol}, falling back to single-shot:`, err instanceof Error ? err.message : err);
    return generateTickerReport(symbol, agg, fundamentals, aiScore, signalType, novelty);
  }
}

function defaultReport(symbol: string): TickerReport {
  return {
    catalyst: "Unable to determine catalyst — AI analysis unavailable.",
    risks: "Full risk assessment unavailable. Exercise caution.",
    recommendation: "Watch",
    report: `Signal detected for ${symbol} but AI analysis could not be completed. Manual review recommended.`,
  };
}
