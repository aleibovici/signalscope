// Deterministic recommendation derivation. Replaces the LLM-chosen
// recommendation label with a rule-based function calibrated against
// realized 7d returns over the last 90d of TickerPerformance.
//
// Calibration (run 2026-05-22, 25,116 perf rows, no corp actions):
//   Strong Buy (CONFIRMED+catalyst+src>=3+score>=70): n=18,  mean7d=+5.72%, hit7d=75.0%
//   Buy A (CONFIRMED+score>=60):                      n=136, mean7d=+2.50%, hit7d=61.1%
//   Buy B (catalyst+src>=2+score>=55):                n=303, mean7d=+2.52%, hit7d=62.4%
//   Avoid (pndFlagged):                               n=731, hit7d=36.8%
//   Avoid (price<$0.12):                              n=472, hit7d=33.4%
//   Baseline (all rows):                              n=25116, hit7d=47.8%
//
// FORMING+src>=2+score>=60 (mean7d=+1.52%, hit7d=60.4%) was tested as a
// third Buy path and rejected — it cleared hit_rate but failed the mean
// return bar (+2% required). Those signals fall through to Watch.
//
// aiScore<20+no_catalyst was tested as an Avoid path and rejected —
// hit7d=49.0% is at baseline, so calling these Avoid would overstate
// confidence. Those signals also fall through to Watch.

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
export const RECOMMENDATION_RULE_VERSION = 1;

/**
 * Derives the recommendation label from quantitative inputs. Pure function —
 * same input always returns the same output. No DB, no I/O, no AI.
 *
 * Order: hard-Avoid wins, then Strong Buy, then Buy paths, else Watch.
 */
export function deriveRecommendation(ctx: RecommendationInput): Recommendation {
  // --- Hard Avoid (override everything) ---
  // Only paths that showed sub-baseline hit rates in calibration. Low score
  // alone is noise (hit~baseline) and falls through to Watch, not Avoid.
  if (ctx.stage === "FILTERED") return "Avoid";
  if (ctx.pndFlagged) return "Avoid";
  if (ctx.price !== null && ctx.price < 0.12) return "Avoid";

  // --- Strong Buy (rare by design) ---
  const signalsFresh = ctx.medianSignalAgeHrs === null || ctx.medianSignalAgeHrs <= 6;
  if (
    ctx.stage === "CONFIRMED" &&
    ctx.hasCatalystSource &&
    ctx.sourceCount >= 3 &&
    ctx.aiScore >= 70 &&
    signalsFresh
  ) {
    return "Strong Buy";
  }

  // --- Buy (any path matches) ---
  // Path A: CONFIRMED stage with solid score.
  if (ctx.stage === "CONFIRMED" && ctx.aiScore >= 60) return "Buy";
  // Path B: catalyst-led with corroboration.
  if (ctx.hasCatalystSource && ctx.sourceCount >= 2 && ctx.aiScore >= 55) return "Buy";

  // --- Watch (default) ---
  return "Watch";
}

/** True when the bracket math (target/stop) should attach to the report. */
export function recommendationHasTradeSetup(rec: Recommendation): boolean {
  return rec === "Buy" || rec === "Strong Buy";
}
