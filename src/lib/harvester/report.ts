import { chatJSON } from "@/lib/ai";
import type { AggregatedSymbol, FundamentalData, NoveltyContext, SignalType, TickerReport } from "./types";

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
      systemPrompt: `You are a senior equity analyst. Generate a concise, honest breakout report for the given stock symbol.

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
- Buy: Real catalyst with at least 2 corroborating sources.
- Watch: Interesting signal but needs more confirmation or catalyst is unverified.
- Avoid: No real catalyst, pure social hype, or P&D risk indicators.

Return JSON:
{
  "catalyst": "1-2 sentence catalyst summary — lead with insider/options if present",
  "risks": "1-2 sentence key risks — be specific",
  "recommendation": "Strong Buy|Buy|Watch|Avoid",
  "report": "3-5 paragraph analysis covering catalyst, technical setup, short interest, risk factors, and outlook. State confidence level explicitly."
}`,
      userMessage: JSON.stringify({
        symbol,
        signalType: signalType || "unknown",
        signalCount: agg.signals.length,
        sourceCount: agg.sourceCount,
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
        sampleSignals: agg.signals.slice(0, 5).map((s) => ({
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
      }),
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
    return raw as TickerReport;
  } catch (err) {
    console.error(`Report generation for ${symbol} error:`, err);
    return defaultReport(symbol);
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
