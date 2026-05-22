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
// EARLY-stage paths were tested and rejected:
//   - "EARLY + catalyst + src>=2 + score>=70" yielded n=0 — by stage
//     definition, multi-source corroboration promotes a ticker out of EARLY
//     into FORMING, so the path is structurally unreachable.
//   - "EARLY + catalyst + score>=70" yielded n=266, mean7d=-0.23%, hit7d=43.1%
//     — actively below baseline. High-AI-score EARLY signals appear to skew
//     toward pump dynamics rather than durable moves.
//   - "EARLY + score>=80" yielded n=139, mean7d=+0.25%, hit7d=48.4% — at
//     baseline; no edge worth labeling.
//   EARLY signals therefore default to Watch: brand-aligned exposure on the
//   dashboard without a recommendation label the data cannot support.

import type { TickerStage } from "@/generated/prisma/client";

export type Recommendation = "Strong Buy" | "Buy" | "Watch" | "Avoid";

export interface RecommendationInput {
  aiScore: number;
  stage: TickerStage | "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" | "UNSCORED";
  sourceCount: number;
  hasCatalystSource: boolean;
  pndFlagged: boolean;
  price: number | null;
  /** null when signals are non-social (insider, congress, options) — treated as fresh */
  medianSignalAgeHrs: number | null;
}

/** Bump when rule semantics change so downstream consumers can detect drift. */
export const RECOMMENDATION_RULE_VERSION = 2;

/**
 * Derives the recommendation label from quantitative inputs. Pure function —
 * same input always returns the same output. No DB, no I/O, no AI.
 *
 * Order: hard-Avoid wins, then Strong Buy, then Buy paths in priority order,
 * else Watch.
 */
export function deriveRecommendation(ctx: RecommendationInput): Recommendation {
  // --- Hard Avoid (override everything) ---
  // Only paths that showed sub-baseline hit rates in calibration. Low score
  // alone is noise (hit~baseline) and falls through to Watch, not Avoid.
  if (ctx.stage === "FILTERED") return "Avoid";
  if (ctx.pndFlagged) return "Avoid";
  if (ctx.price !== null && ctx.price < 0.12) return "Avoid";

  const signalsFresh = ctx.medianSignalAgeHrs === null || ctx.medianSignalAgeHrs <= 6;

  // --- Strong Buy (rare by design) ---
  // FORMING stage = emerging with cross-source momentum. Catalyst = real,
  // verifiable smart-money signal (insider buy / unusual options / congress).
  // Two sources of corroboration filter out single-platform pump dynamics.
  if (
    ctx.stage === "FORMING" &&
    ctx.hasCatalystSource &&
    ctx.sourceCount >= 2 &&
    ctx.aiScore >= 60
  ) {
    return "Strong Buy";
  }

  // --- Buy (any path matches) ---
  // Path A: catalyst-led EARLY/FORMING (any pre-consensus stage with hard
  // catalyst + multi-source — note EARLY+src>=2 is structurally rare).
  if (
    (ctx.stage === "EARLY" || ctx.stage === "FORMING") &&
    ctx.hasCatalystSource &&
    ctx.sourceCount >= 2 &&
    ctx.aiScore >= 55
  ) {
    return "Buy";
  }

  // Path B: FORMING with broad social momentum and decent score.
  if (ctx.stage === "FORMING" && ctx.sourceCount >= 2 && ctx.aiScore >= 60) {
    return "Buy";
  }

  // Path C: CONFIRMED soft-demotion. Consensus stage = already moved; only
  // labeled Buy when signals are still fresh enough that the move may not
  // be exhausted.
  if (ctx.stage === "CONFIRMED" && ctx.aiScore >= 60 && signalsFresh) {
    return "Buy";
  }

  // --- Watch (default) ---
  return "Watch";
}

/** True when the bracket math (target/stop) should attach to the report. */
export function recommendationHasTradeSetup(rec: Recommendation): boolean {
  return rec === "Buy" || rec === "Strong Buy";
}
