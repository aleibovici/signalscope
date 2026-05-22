import { chatJSON } from "@/lib/ai";
import type { AiCostContext } from "@/lib/ai/types";
import { chatReACT, validateTradeSetup } from "@/lib/ai/react";
import { getTradeBracket, holdDaysForStage, FALLBACK_TARGET_PCT, STOP_R_R_RATIO } from "@/lib/anchors";
import { TickerStage } from "@/generated/prisma/client";
import { deriveRecommendation, recommendationHasTradeSetup, type Recommendation } from "./recommendation";
import type { AggregatedSymbol, FundamentalData, NoveltyContext, SignalType, TickerReport, TradeSetup } from "./types";

/**
 * Override the AI's target/stop with data-anchored values derived from
 * realized 7d returns for this stage (P90 target, R:R 1:1.5 stop). The AI
 * supplies entryLo/entryHi only; the bracket math comes from production data.
 *
 * Preserves the rest of the AI's setup (timeframe, confidence). Drops the
 * setup entirely if entry range is missing or invalid.
 */
export async function applyAnchoredBracket(
  setup: TradeSetup | undefined,
  stage: TickerStage,
): Promise<TradeSetup | undefined> {
  if (!setup || !Number.isFinite(setup.entryLo) || !Number.isFinite(setup.entryHi)) {
    return undefined;
  }
  if (setup.entryLo <= 0 || setup.entryHi <= 0 || setup.entryHi < setup.entryLo) {
    return undefined;
  }

  let bracket: { targetPct: number; stopPct: number };
  try {
    bracket = await getTradeBracket(stage);
  } catch (err) {
    // DB unavailable — fall back to the same hardcoded per-stage percentages
    // that getTradeBracket uses when its sample is too small. Keeps target /
    // stop sensible rather than persisting placeholder zeros from the LLM.
    const fallback = FALLBACK_TARGET_PCT[stage];
    console.warn(
      `[report] anchor lookup failed, using ${(fallback * 100).toFixed(0)}% fallback for ${stage}:`,
      err instanceof Error ? err.message : err,
    );
    bracket = { targetPct: fallback, stopPct: -fallback * STOP_R_R_RATIO };
  }
  const holdDays = holdDaysForStage(stage);
  const entryMid = (setup.entryLo + setup.entryHi) / 2;
  const target1 = round2(entryMid * (1 + bracket.targetPct));
  const target2 = round2(entryMid * (1 + bracket.targetPct * 1.5));
  const stopLoss = round2(entryMid * (1 + bracket.stopPct));
  const rrRatio = bracket.targetPct / Math.abs(bracket.stopPct);

  return {
    entryLo: setup.entryLo,
    entryHi: setup.entryHi,
    stopLoss,
    target1,
    target2,
    timeframe: `up to ${holdDays} days`,
    riskReward: `1:${rrRatio.toFixed(1)}`,
    confidence: setup.confidence,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

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
      body: s.body,
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
- Be direct about confidence level. Do NOT hype weak signals. If evidence is thin, say "Low confidence — social signal only, no verifiable catalyst."
- Never use vague hype language like "could be huge" or "massive potential." State what is known and what is speculation.

Catalyst field format — extract actual values from sampleSignals (title + body fields contain the date, name, and amount). Never output literal placeholder text like [date] or [name].
- If insider_buy: "CEO/CFO <name> purchased $<amount> of stock on <date from body> — insider buying signals confidence in near-term outlook." Omit date phrase if not found in body.
- If options_flow: "Unusual <call/put> activity detected — <volume> contracts vs <OI> open interest (<ratio>x), suggesting smart money positioning."
- If congress: "<Chamber> <Name> (<Party>) purchased ~$<amount> of <ticker> on <date from body> — congressional trading often precedes policy-driven moves." Omit date phrase if not found in body.
- If multi_source: Lead with the strongest non-social signal (insider, congress, or options), then note cross-source corroboration.
- If reddit_velocity only: "Social signal only — <describe what's being discussed>. No insider or institutional confirmation yet."

Also analyze:
- Short squeeze potential: high short float % + real catalyst = squeeze candidate
- Price position relative to 52-week range
- Signal novelty: first appearance (novel) signals may represent early detection before consensus; recurring signals (3+ appearances) may be stale unless a new catalyst type has appeared
- Key risks and downside scenarios

IMPORTANT: Check the "sources" array in the input — it shows ALL source types that contributed signals, not just the sample. A ticker with signals from 3+ sources or 3+ subreddits represents genuine cross-platform consensus, not mere hype. Do not dismiss multi-source social consensus as "pure social hype" — coordinated independent discovery across platforms is a meaningful signal.

Trade setup rules — you emit EXACTLY three fields, the server computes the rest:
- entryLo / entryHi: tight range around current price or a technical level (typically within 2-5% of current price). Required when you emit tradeSetup. If you cannot derive a technically sound entry, omit the tradeSetup field entirely.
- confidence: "High" = insider/congress + multi-source; "Medium" = real catalyst, fewer sources; "Low" = speculative setup. Must be exactly "Low", "Medium", or "High".
- DO NOT emit stopLoss, target1, target2, timeframe, or riskReward. They are computed server-side from production performance data anchored to the stock's stage. Anything you put there will be discarded.

Server-side post-processing (informational, not your job):
- The Strong Buy / Buy / Watch / Avoid recommendation label is computed deterministically server-side from the ticker's score, stage, source mix, catalyst presence, and P&D flags. Do not pick it — do not emit a "recommendation" field.
- If the computed recommendation is Watch or Avoid, the tradeSetup is dropped server-side.

Return JSON:
{
  "catalyst": "1-2 sentence catalyst summary — lead with insider/options if present",
  "risks": "1-2 sentence key risks — be specific",
  "report": "3-5 paragraph analysis. Begin each paragraph with a bold section label followed by an em-dash, e.g. '**Catalyst** — ', '**Technical Setup** — ', '**Short Interest** — ', '**Risk Factors** — ', '**Outlook** — '. Labels should match the content; these exact names are not required. State confidence level explicitly.",
  "tradeSetup": {
    "entryLo": <number>,
    "entryHi": <number>,
    "confidence": "Low|Medium|High"
  }
}`;

export async function generateTickerReport(
  symbol: string,
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  signalType?: SignalType,
  novelty?: NoveltyContext,
  context?: AiCostContext,
  stage: TickerStage = TickerStage.EARLY,
  pndFlagged: boolean = false,
): Promise<TickerReport> {
  try {
    const response = await chatJSON({
      callPoint: "report",
      tier: "standard",
      temperature: 0.4,
      systemPrompt: REPORT_SYSTEM_PROMPT,
      userMessage: buildTickerContext(symbol, agg, fundamentals, aiScore, signalType, novelty),
      context,
    });

    const raw = JSON.parse(response.content);
    if (
      !raw ||
      typeof raw.catalyst !== "string" ||
      typeof raw.risks !== "string" ||
      typeof raw.report !== "string"
    ) {
      console.warn(`Report for ${symbol} returned invalid structure, using default`);
      return defaultReport(symbol);
    }

    // Compute the recommendation deterministically server-side. Overrides any
    // value the LLM may have included.
    raw.recommendation = computeRecommendation(agg, fundamentals, aiScore, stage, pndFlagged);

    // Validate optional tradeSetup — drop silently if malformed or if the
    // computed recommendation doesn't warrant one.
    if (raw.tradeSetup !== undefined && raw.tradeSetup !== null) {
      raw.tradeSetup = validateTradeSetup(raw.tradeSetup);
      if (!raw.tradeSetup) {
        console.warn(`Report for ${symbol} has invalid tradeSetup shape, dropping it`);
      }
    }
    if (raw.tradeSetup && !recommendationHasTradeSetup(raw.recommendation as Recommendation)) {
      raw.tradeSetup = undefined;
    }
    if (raw.tradeSetup) {
      raw.tradeSetup = await applyAnchoredBracket(raw.tradeSetup, stage);
    }

    return raw as TickerReport;
  } catch (err) {
    console.error(`Report generation for ${symbol} error:`, err);
    return defaultReport(symbol);
  }
}

function computeRecommendation(
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  stage: TickerStage,
  pndFlagged: boolean,
): Recommendation {
  const sources = new Set(agg.signals.map((s) => s.source));
  const hasCatalystSource =
    sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("CONGRESS");
  return deriveRecommendation({
    aiScore,
    stage,
    sourceCount: agg.sourceCount,
    hasCatalystSource,
    pndFlagged,
    price: fundamentals?.price ?? null,
    medianSignalAgeHrs: agg.medianSignalAgeHrs,
  });
}

export async function generateTickerReportReACT(
  symbol: string,
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  scanId: string,
  signalType?: SignalType,
  novelty?: NoveltyContext,
  context?: AiCostContext,
  stage: TickerStage = TickerStage.EARLY,
  pndFlagged: boolean = false,
): Promise<TickerReport> {
  try {
    const report = await chatReACT({
      symbol,
      scanId,
      initialContext: buildTickerContext(symbol, agg, fundamentals, aiScore, signalType, novelty),
      reportSystemPrompt: REPORT_SYSTEM_PROMPT,
      temperature: 0.4,
      context,
    });
    report.recommendation = computeRecommendation(agg, fundamentals, aiScore, stage, pndFlagged);
    if (report.tradeSetup && !recommendationHasTradeSetup(report.recommendation as Recommendation)) {
      report.tradeSetup = undefined;
    }
    if (report.tradeSetup) {
      report.tradeSetup = await applyAnchoredBracket(report.tradeSetup, stage);
    }
    return report;
  } catch (err) {
    console.warn(`[react] ReACT failed for ${symbol}, falling back to single-shot:`, err instanceof Error ? err.message : err);
    return generateTickerReport(symbol, agg, fundamentals, aiScore, signalType, novelty, context, stage, pndFlagged);
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
