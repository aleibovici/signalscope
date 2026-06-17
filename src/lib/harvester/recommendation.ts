// Deterministic recommendation derivation. Replaces any LLM-chosen
// recommendation label with a rule-based function calibrated against
// realized 7d returns over the last 90d of TickerPerformance.
//
// Rule v2 (2026-05-23) — emerging-focused:
//   The product surfaces emerging stocks; consensus tickers are "already
//   moved" and capped at Buy with a freshness gate. Strong Buy is reserved
//   for the "we caught it while it was still emerging AND smart-money is
//   real" zone — FORMING-stage signals with a hard catalyst (insider /
//   options / congress) plus multi-source corroboration.
//
// Calibration (run 2026-05-23, 25,573 perf rows, no corp actions):
//   Strong Buy (FORMING + catalyst + src>=2 + score>=60):
//     n~109, mean7d=+2.17%, hit7d=65.0%
//   Buy A (EARLY/FORMING + catalyst + src>=2 + score>=55):
//     n=169, mean7d=+2.49%, hit7d=63.0%
//   Buy B (FORMING + src>=2 + score>=60):
//     n=158, mean7d=+1.56%, hit7d=60.4%
//   Buy C (CONFIRMED + score>=60 + FRESH ≤6h):
//     n=111, mean7d=+2.44%, hit7d=61.2%
//   Avoid (pndFlagged):                   n=732, hit7d=36.9%
//   Avoid (price<$0.12):                  n=484, hit7d=33.2%
//   Baseline (all rows):                  n=25573, hit7d=47.9%
//
// Rule v3 (2026-06-05) — executable labels stay below the large-cap tier.
//   Recent execution changes started buying every Buy/Strong Buy row, which
//   exposed that fresh CONFIRMED/large-cap rows could still get actionable
//   labels. Mega/large caps are now demoted to Watch so the product stays
//   focused on emerging breakouts rather than consensus blue-chip chatter.
//
// Rule v4 (2026-06-18) — raise market-cap cap from $10B → $1T.
//   The $10B cap was blocking all strong catalyst signals (INTC/AMD/GE
//   CONFIRMED with aiScore 65-75) while small-cap signals stayed below the
//   55-60 aiScore threshold. Dead zone: no Buy signals for 13 days.
//   $1T keeps true mega-caps (AAPL/NVDA/MSFT/GOOGL/AMZN ≥ $1.5T) at Watch
//   while restoring Buy eligibility for large-cap catalyst-backed signals.

import type { TickerStage } from "@/generated/prisma/client";
import type { AggregatedSymbol, FundamentalData, Source } from "./types";

export type Recommendation = "Strong Buy" | "Buy" | "Watch" | "Avoid";

/** Insider / options / congress — the only sources that count as a hard catalyst for rec rules. */
export const HARD_CATALYST_SOURCES = new Set<Source>(["SEC_INSIDER", "OPTIONS_FLOW", "CONGRESS"]);
/** Large-cap threshold used by peer-context buckets; above this is no longer an actionable breakout label.
 *  Set to $1T to block only true mega-caps (AAPL/NVDA/MSFT/GOOGL/AMZN) while allowing large-caps
 *  with genuine catalyst signals (INTC, AMD, GE, AVGO etc.) to surface as Buy recommendations. */
export const ACTIONABLE_MARKET_CAP_MAX = 1_000_000_000_000;

export function hasHardCatalyst(sources: Iterable<Source>): boolean {
  for (const source of sources) {
    if (HARD_CATALYST_SOURCES.has(source)) return true;
  }
  return false;
}

export interface RecommendationInput {
  aiScore: number;
  stage: TickerStage;
  sourceCount: number;
  hasCatalystSource: boolean;
  pndFlagged: boolean;
  price: number | null;
  marketCap: number | null;
  /** null when signals are non-social (insider, congress, options) — treated as fresh */
  medianSignalAgeHrs: number | null;
}

function signalsFresh(ctx: RecommendationInput): boolean {
  return ctx.medianSignalAgeHrs === null || ctx.medianSignalAgeHrs <= 6;
}

function isEmergingStage(stage: TickerStage): boolean {
  return stage === "EARLY" || stage === "FORMING";
}

function isActionableMarketCap(ctx: RecommendationInput): boolean {
  return ctx.marketCap === null || ctx.marketCap <= ACTIONABLE_MARKET_CAP_MAX;
}

export interface RecommendationRulePath {
  id: string;
  label: string;
  recommendation: Recommendation;
  match: (ctx: RecommendationInput) => boolean;
}

/** Ordered rule paths — first match wins. Shared by deriveRecommendation and calibration. */
export const RECOMMENDATION_RULE_PATHS: readonly RecommendationRulePath[] = [
  {
    id: "avoid_filtered",
    label: "Avoid: FILTERED stage",
    recommendation: "Avoid",
    match: (ctx) => ctx.stage === "FILTERED",
  },
  {
    id: "avoid_pnd",
    label: "Avoid: pndFlagged",
    recommendation: "Avoid",
    match: (ctx) => ctx.pndFlagged,
  },
  {
    id: "avoid_penny",
    label: "Avoid: price < $0.12",
    recommendation: "Avoid",
    match: (ctx) => ctx.price !== null && ctx.price < 0.12,
  },
  {
    id: "strong_buy",
    label: "Strong Buy: FORMING + catalyst + src>=2 + score>=60",
    recommendation: "Strong Buy",
    match: (ctx) =>
      ctx.stage === "FORMING" &&
      isActionableMarketCap(ctx) &&
      ctx.hasCatalystSource &&
      ctx.sourceCount >= 2 &&
      ctx.aiScore >= 60,
  },
  {
    id: "buy_a",
    label: "Buy A: EARLY/FORMING + catalyst + src>=2 + score>=55",
    recommendation: "Buy",
    match: (ctx) =>
      isEmergingStage(ctx.stage) &&
      isActionableMarketCap(ctx) &&
      ctx.hasCatalystSource &&
      ctx.sourceCount >= 2 &&
      ctx.aiScore >= 55,
  },
  {
    id: "buy_b",
    label: "Buy B: FORMING + src>=2 + score>=60",
    recommendation: "Buy",
    match: (ctx) =>
      ctx.stage === "FORMING" &&
      isActionableMarketCap(ctx) &&
      ctx.sourceCount >= 2 &&
      ctx.aiScore >= 60,
  },
  {
    id: "buy_c",
    label: "Buy C: CONFIRMED + score>=60 + FRESH",
    recommendation: "Buy",
    match: (ctx) =>
      ctx.stage === "CONFIRMED" &&
      isActionableMarketCap(ctx) &&
      ctx.aiScore >= 60 &&
      signalsFresh(ctx),
  },
];

/** Build the pure-function input from pipeline aggregates — single canonical catalyst check. */
export function buildRecommendationInput(
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null,
  aiScore: number,
  stage: TickerStage,
  pndFlagged: boolean,
): RecommendationInput {
  return {
    aiScore,
    stage,
    sourceCount: agg.sourceCount,
    hasCatalystSource: hasHardCatalyst(agg.signals.map((s) => s.source)),
    pndFlagged,
    price: fundamentals?.price ?? null,
    marketCap: fundamentals?.marketCap ?? null,
    medianSignalAgeHrs: agg.medianSignalAgeHrs,
  };
}

/** Bump when rule semantics change so downstream consumers can detect drift. */
export const RECOMMENDATION_RULE_VERSION = 4;

/**
 * Derives the recommendation label from quantitative inputs. Pure function —
 * same input always returns the same output. No DB, no I/O, no AI.
 */
export function deriveRecommendation(ctx: RecommendationInput): Recommendation {
  for (const rule of RECOMMENDATION_RULE_PATHS) {
    if (rule.match(ctx)) return rule.recommendation;
  }
  return "Watch";
}

/** True when the bracket math (target/stop) should attach to the report. */
export function recommendationHasTradeSetup(rec: Recommendation): boolean {
  return rec === "Buy" || rec === "Strong Buy";
}
