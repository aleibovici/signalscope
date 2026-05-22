# Deterministic Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LLM's free-text `recommendation` choice (`Strong Buy | Buy | Watch | Avoid`) with a deterministic rule derived from inputs the rest of the pipeline already trusts (`aiScore`, `stage`, `sourceCount`, catalyst presence, P&D flags, fundamentals).

**Architecture:** A new pure function `deriveRecommendation(ctx)` lives in `src/lib/harvester/recommendation.ts`. Thresholds are calibrated once against `TickerPerformance` × `ValidatedTicker` historical data via a one-time script, then locked. The report pipeline still uses the LLM for prose (`catalyst`, `risks`, `report`) but the recommendation field is overwritten server-side after the LLM returns, mirroring how `applyAnchoredBracket` already overrides target/stop. Forward-only: existing rows keep their AI-assigned labels.

**Tech Stack:** TypeScript 5, Prisma 7, Vitest 4, Next.js 16.

---

## File Structure

**Create:**
- `src/lib/harvester/recommendation.ts` — pure `deriveRecommendation()` function + `RecommendationInput` type + `RECOMMENDATION_RULE_VERSION` constant
- `src/__tests__/recommendation.test.ts` — unit tests covering each rule branch
- `scripts/calibrate-recommendation.ts` — one-shot DB calibration query (prints, does not write)

**Modify:**
- `src/lib/harvester/report.ts` — strip `recommendation` from JSON contract in `REPORT_SYSTEM_PROMPT`; compute deterministically in `generateTickerReport()` and `generateTickerReportReACT()`; drop `tradeSetup` when computed rec is not `Buy`/`Strong Buy`
- `src/lib/ai/react.ts` — keep parsing tolerant of LLM-supplied `recommendation` (don't break old prompts), but caller in `report.ts` overwrites it
- `src/lib/methodology-data.ts` — update `recommendationLevels` descriptions to reflect deterministic rule
- `src/__tests__/report-react.test.ts` — update assertions that pinned a specific LLM recommendation
- `src/__tests__/report.test.ts` (if exists) — same

---

## Task 1: Calibration Script

Probe historical `TickerPerformance` data to confirm threshold cuts produce positive expected return and hit-rate ≥ 55%. Prints a table; does not write to DB. Output drives threshold choices in Task 2.

**Files:**
- Create: `scripts/calibrate-recommendation.ts`

- [ ] **Step 1: Create the calibration script**

```typescript
// scripts/calibrate-recommendation.ts
// One-shot calibration: for each candidate recommendation rule, compute
// hit-rate and mean realized 3d/7d return on the last 90d of TickerPerformance.
// Run: npx tsx scripts/calibrate-recommendation.ts

import { prisma } from "@/lib/prisma";

interface Row {
  symbol: string;
  aiScore: number;
  stage: string;
  sourceCount: number;
  hasCatalystSource: boolean;
  pndFlagged: boolean;
  price: number | null;
  return3d: number | null;
  return7d: number | null;
}

async function main() {
  const since = new Date(Date.now() - 90 * 86400000);

  const perf = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: since },
      corporateActionDetected: false,
    },
    select: {
      return3d: true,
      return7d: true,
      validatedTicker: {
        select: {
          symbol: true,
          aiScore: true,
          stage: true,
          sourceCount: true,
          pndFlagged: true,
          price: true,
          signals: { select: { source: true } },
        },
      },
    },
  });

  const CATALYST = new Set(["SEC_INSIDER", "OPTIONS_FLOW", "CONGRESS"]);
  const rows: Row[] = perf
    .filter((p) => p.validatedTicker !== null)
    .map((p) => {
      const vt = p.validatedTicker!;
      const sources = new Set(vt.signals.map((s) => s.source));
      const hasCatalystSource = [...CATALYST].some((c) => sources.has(c));
      return {
        symbol: vt.symbol,
        aiScore: vt.aiScore ?? 0,
        stage: vt.stage,
        sourceCount: vt.sourceCount ?? 0,
        hasCatalystSource,
        pndFlagged: vt.pndFlagged ?? false,
        price: vt.price,
        return3d: p.return3d,
        return7d: p.return7d,
      };
    });

  console.log(`\nLoaded ${rows.length} performance rows (last 90d, no corp actions).\n`);

  function evaluate(label: string, predicate: (r: Row) => boolean) {
    const matched = rows.filter(predicate);
    const with3d = matched.filter((r) => r.return3d !== null);
    const with7d = matched.filter((r) => r.return7d !== null);
    const mean3d = with3d.length ? with3d.reduce((s, r) => s + (r.return3d as number), 0) / with3d.length : 0;
    const mean7d = with7d.length ? with7d.reduce((s, r) => s + (r.return7d as number), 0) / with7d.length : 0;
    const hit3d = with3d.length ? with3d.filter((r) => (r.return3d as number) > 0).length / with3d.length : 0;
    const hit7d = with7d.length ? with7d.filter((r) => (r.return7d as number) > 0).length / with7d.length : 0;
    console.log(
      `${label.padEnd(50)} n=${String(matched.length).padStart(5)}  ` +
        `mean3d=${(mean3d * 100).toFixed(2).padStart(7)}%  hit3d=${(hit3d * 100).toFixed(1).padStart(5)}%  ` +
        `mean7d=${(mean7d * 100).toFixed(2).padStart(7)}%  hit7d=${(hit7d * 100).toFixed(1).padStart(5)}%`
    );
  }

  console.log("== Strong Buy candidates ==");
  evaluate("CONFIRMED + catalyst + src≥3 + score≥70", (r) =>
    r.stage === "CONFIRMED" && r.hasCatalystSource && r.sourceCount >= 3 && r.aiScore >= 70
  );
  evaluate("CONFIRMED + catalyst + src≥3 + score≥75", (r) =>
    r.stage === "CONFIRMED" && r.hasCatalystSource && r.sourceCount >= 3 && r.aiScore >= 75
  );

  console.log("\n== Buy candidates ==");
  evaluate("CONFIRMED + score≥60", (r) => r.stage === "CONFIRMED" && r.aiScore >= 60);
  evaluate("CONFIRMED + score≥65", (r) => r.stage === "CONFIRMED" && r.aiScore >= 65);
  evaluate("catalyst + src≥2 + score≥55", (r) => r.hasCatalystSource && r.sourceCount >= 2 && r.aiScore >= 55);
  evaluate("FORMING + src≥2 + score≥60", (r) => r.stage === "FORMING" && r.sourceCount >= 2 && r.aiScore >= 60);

  console.log("\n== Avoid candidates ==");
  evaluate("pndFlagged=true", (r) => r.pndFlagged);
  evaluate("price < $0.12", (r) => r.price !== null && r.price < 0.12);
  evaluate("score < 20 + no catalyst", (r) => r.aiScore < 20 && !r.hasCatalystSource);

  console.log("\n== Baseline (all rows) ==");
  evaluate("ALL", () => true);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the calibration**

```bash
npx tsx scripts/calibrate-recommendation.ts | tee /tmp/calibration.txt
```

Expected output: a table where each candidate rule has `n` (sample size), `mean3d/7d` (mean realized return), `hit3d/7d` (% positive). Use this to decide final cuts in Task 2.

**Acceptance criteria for thresholds chosen in Task 2:**
- **Strong Buy**: mean7d > +5% AND hit7d > 60% AND n ≥ 30
- **Buy**: mean7d > +2% AND hit7d > 55% AND n ≥ 100
- **Avoid**: mean7d < -1% OR pndFlagged

If a proposed cut fails the acceptance criteria, tighten the threshold (e.g. raise score from 70 to 75) until it passes. Document the chosen numbers in a code comment in `recommendation.ts`.

- [ ] **Step 3: Commit calibration script**

```bash
git add scripts/calibrate-recommendation.ts
git commit -m "Add one-shot recommendation threshold calibration script"
```

---

## Task 2: Pure `deriveRecommendation()` function with TDD

The function must be deterministic, side-effect free, and depend only on values already available at recommendation time. Thresholds in this scaffold are the initial proposal; replace with calibrated values from Task 1 before merging.

**Files:**
- Create: `src/lib/harvester/recommendation.ts`
- Create: `src/__tests__/recommendation.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
// src/__tests__/recommendation.test.ts
import { describe, expect, it } from "vitest";
import {
  deriveRecommendation,
  type RecommendationInput,
} from "@/lib/harvester/recommendation";

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    aiScore: 50,
    stage: "FORMING",
    sourceCount: 2,
    hasCatalystSource: false,
    pndFlagged: false,
    price: 5,
    medianSignalAgeHrs: 4,
    ...overrides,
  };
}

describe("deriveRecommendation", () => {
  it("returns Avoid when P&D flagged", () => {
    expect(deriveRecommendation(input({ pndFlagged: true, aiScore: 90, stage: "CONFIRMED" }))).toBe("Avoid");
  });

  it("returns Avoid for sub-$0.12 stocks", () => {
    expect(deriveRecommendation(input({ price: 0.10, aiScore: 80, hasCatalystSource: true }))).toBe("Avoid");
  });

  it("returns Avoid for very low score with no catalyst", () => {
    expect(deriveRecommendation(input({ aiScore: 15, hasCatalystSource: false }))).toBe("Avoid");
  });

  it("does NOT return Avoid for low score when catalyst exists", () => {
    expect(deriveRecommendation(input({ aiScore: 15, hasCatalystSource: true, sourceCount: 1 }))).not.toBe("Avoid");
  });

  it("returns Strong Buy when CONFIRMED + catalyst + 3 sources + score≥70 + fresh signals", () => {
    expect(
      deriveRecommendation(
        input({ stage: "CONFIRMED", hasCatalystSource: true, sourceCount: 3, aiScore: 72, medianSignalAgeHrs: 4 })
      )
    ).toBe("Strong Buy");
  });

  it("does NOT return Strong Buy when signals are stale", () => {
    expect(
      deriveRecommendation(
        input({ stage: "CONFIRMED", hasCatalystSource: true, sourceCount: 3, aiScore: 72, medianSignalAgeHrs: 10 })
      )
    ).not.toBe("Strong Buy");
  });

  it("returns Buy for CONFIRMED + score≥60", () => {
    expect(deriveRecommendation(input({ stage: "CONFIRMED", aiScore: 62 }))).toBe("Buy");
  });

  it("returns Buy for catalyst-led + 2 sources + score≥55", () => {
    expect(
      deriveRecommendation(input({ hasCatalystSource: true, sourceCount: 2, aiScore: 57, stage: "EARLY" }))
    ).toBe("Buy");
  });

  it("returns Buy for FORMING + 2 sources + score≥60", () => {
    expect(deriveRecommendation(input({ stage: "FORMING", sourceCount: 2, aiScore: 61 }))).toBe("Buy");
  });

  it("returns Watch for EARLY social-only signals", () => {
    expect(
      deriveRecommendation(input({ stage: "EARLY", hasCatalystSource: false, sourceCount: 1, aiScore: 35 }))
    ).toBe("Watch");
  });

  it("returns Watch for FORMING with insufficient sources", () => {
    expect(deriveRecommendation(input({ stage: "FORMING", sourceCount: 1, aiScore: 55 }))).toBe("Watch");
  });

  it("is deterministic — same input always produces same output", () => {
    const i = input({ stage: "FORMING", aiScore: 62, sourceCount: 2 });
    expect(deriveRecommendation(i)).toBe(deriveRecommendation(i));
  });

  it("treats null medianSignalAgeHrs (non-social signals) as fresh", () => {
    expect(
      deriveRecommendation(
        input({ stage: "CONFIRMED", hasCatalystSource: true, sourceCount: 3, aiScore: 72, medianSignalAgeHrs: null })
      )
    ).toBe("Strong Buy");
  });

  it("FILTERED stage always returns Avoid", () => {
    expect(deriveRecommendation(input({ stage: "FILTERED" }))).toBe("Avoid");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/recommendation.test.ts
```

Expected: FAIL — module `@/lib/harvester/recommendation` not found.

- [ ] **Step 3: Implement the function**

```typescript
// src/lib/harvester/recommendation.ts
//
// Deterministic recommendation derivation. Replaces the LLM-chosen
// recommendation label with a rule-based function calibrated against
// realized 7d returns over the last 90d of TickerPerformance.
//
// Calibration: see scripts/calibrate-recommendation.ts and the
// 2026-05-22 calibration run committed alongside the locked thresholds.

import type { TickerStage } from "@/generated/prisma/client";

export type Recommendation = "Strong Buy" | "Buy" | "Watch" | "Avoid";

export interface RecommendationInput {
  aiScore: number;
  stage: TickerStage | "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" | "UNSCORED";
  sourceCount: number;
  hasCatalystSource: boolean;
  pndFlagged: boolean;
  price: number | null;
  /** null when signals are non-social (insider, congress, options) */
  medianSignalAgeHrs: number | null;
}

/** Increment when rule semantics change so downstream consumers can detect drift. */
export const RECOMMENDATION_RULE_VERSION = 1;

/**
 * Derives the recommendation label from quantitative inputs. Pure function —
 * same input always returns the same output. No DB, no I/O, no AI.
 *
 * Order of evaluation matters: hard-Avoid rules win, then Strong Buy, then
 * Buy paths (any path matching → Buy), else Watch.
 */
export function deriveRecommendation(ctx: RecommendationInput): Recommendation {
  // --- Hard Avoid (override everything) ---
  if (ctx.stage === "FILTERED") return "Avoid";
  if (ctx.pndFlagged) return "Avoid";
  if (ctx.price !== null && ctx.price < 0.12) return "Avoid";
  if (ctx.aiScore < 20 && !ctx.hasCatalystSource) return "Avoid";

  // --- Strong Buy (rare) ---
  // CONFIRMED stage + catalyst source + broad corroboration + high score + fresh signals.
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

  // --- Buy (any path) ---
  // Path A: CONFIRMED with strong score.
  if (ctx.stage === "CONFIRMED" && ctx.aiScore >= 60) return "Buy";
  // Path B: catalyst-led with corroboration.
  if (ctx.hasCatalystSource && ctx.sourceCount >= 2 && ctx.aiScore >= 55) return "Buy";
  // Path C: FORMING with multi-source and strong score.
  if (ctx.stage === "FORMING" && ctx.sourceCount >= 2 && ctx.aiScore >= 60) return "Buy";

  // --- Watch (default) ---
  return "Watch";
}

/** True when the bracket math (target/stop) should attach to the report. */
export function recommendationHasTradeSetup(rec: Recommendation): boolean {
  return rec === "Buy" || rec === "Strong Buy";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/recommendation.test.ts
```

Expected: PASS — all 14 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/harvester/recommendation.ts src/__tests__/recommendation.test.ts
git commit -m "Add deterministic deriveRecommendation function"
```

---

## Task 3: Wire `deriveRecommendation` into `generateTickerReport`

Strip recommendation from the JSON contract in `REPORT_SYSTEM_PROMPT`, then overwrite the LLM-returned field with the deterministic value. Drop `tradeSetup` when the computed recommendation is not `Buy`/`Strong Buy`.

**Files:**
- Modify: `src/lib/harvester/report.ts`

- [ ] **Step 1: Read current state of report.ts**

Confirm callers' shape: `generateTickerReport(symbol, agg, fundamentals, aiScore, signalType?, novelty?, context?, stage?)`. It currently does not receive `sourceCount` directly but `agg.sourceCount` is available. It does not currently receive `pndFlagged`/`price` — both are needed for the rule. Add them as optional parameters with sensible defaults.

- [ ] **Step 2: Update `report.ts` to compute recommendation deterministically**

Replace the `recommendation` line in `REPORT_SYSTEM_PROMPT` (line 165) and the trade-setup gating lines:

```typescript
// Old line 165 inside the JSON template
"recommendation": "Strong Buy|Buy|Watch|Avoid",
```

becomes:

```typescript
// recommendation is computed deterministically server-side — do not emit it
```

Also remove the `Recommendation guidance:` block (lines 147-153) and the `Trade setup rules (ONLY for Buy or Strong Buy ...)` opening clause; replace with:

```
Trade setup rules:
- entryLo/entryHi: tight range around current price or a technical level (typically within 2-5% of current price). Always include these two numbers when you can derive a sound entry; otherwise omit tradeSetup entirely.
- stopLoss, target1, target2, riskReward, timeframe: DO NOT GENERATE — computed server-side from production performance data anchored to the stock's stage. Set numerics to 0 and timeframe to "" or omit them.
- confidence: "High" = insider/congress + multi-source; "Medium" = real catalyst, fewer sources; "Low" = speculative setup.

Server-side post-processing (informational):
- Recommendation (Strong Buy/Buy/Watch/Avoid) is computed from a deterministic rule on the ticker's score, stage, source mix, catalyst presence, and P&D flags. You do not pick it.
- If the computed recommendation is Watch or Avoid, the tradeSetup is dropped.
```

Update the JSON return block to remove the `recommendation` field:

```typescript
Return JSON:
{
  "catalyst": "1-2 sentence catalyst summary — lead with insider/options if present",
  "risks": "1-2 sentence key risks — be specific",
  "report": "3-5 paragraph analysis. Begin each paragraph with a bold section label followed by an em-dash, e.g. '**Catalyst** — ', '**Technical Setup** — ', '**Short Interest** — ', '**Risk Factors** — ', '**Outlook** — '. Labels should match the content; these exact names are not required. State confidence level explicitly.",
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
}
```

Update `generateTickerReport` body (after the LLM call, before `return raw as TickerReport;`) to compute the recommendation deterministically:

```typescript
import { deriveRecommendation, recommendationHasTradeSetup } from "./recommendation";

// ... inside generateTickerReport, after raw is parsed and validated ...
// Validation: catalyst, risks, report must be strings; recommendation no longer required from LLM.
if (
  !raw ||
  typeof raw.catalyst !== "string" ||
  typeof raw.risks !== "string" ||
  typeof raw.report !== "string"
) {
  console.warn(`Report for ${symbol} returned invalid structure, using default`);
  return defaultReport(symbol, agg, fundamentals, aiScore, stage);
}

// Compute deterministic recommendation from the same inputs the rest of the
// pipeline already trusts. Overrides whatever the LLM might have included.
const sources = new Set(agg.signals.map((s) => s.source));
const hasCatalystSource =
  sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("CONGRESS");
const computedRec = deriveRecommendation({
  aiScore,
  stage,
  sourceCount: agg.sourceCount,
  hasCatalystSource,
  pndFlagged,
  price: fundamentals?.price ?? null,
  medianSignalAgeHrs: agg.medianSignalAgeHrs,
});
raw.recommendation = computedRec;

// Validate optional tradeSetup — drop silently if malformed or rec doesn't warrant it
if (raw.tradeSetup !== undefined && raw.tradeSetup !== null) {
  raw.tradeSetup = validateTradeSetup(raw.tradeSetup);
}
if (raw.tradeSetup && !recommendationHasTradeSetup(computedRec)) {
  raw.tradeSetup = undefined;
}
if (raw.tradeSetup) {
  raw.tradeSetup = await applyAnchoredBracket(raw.tradeSetup, stage);
}

return raw as TickerReport;
```

Update `generateTickerReport`'s signature to accept `pndFlagged`:

```typescript
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
```

Update `generateTickerReportReACT` similarly — accept `pndFlagged`, compute recommendation after `chatReACT` returns, override `report.recommendation`, drop `tradeSetup` if computed rec is not Buy/Strong Buy:

```typescript
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

    const sources = new Set(agg.signals.map((s) => s.source));
    const hasCatalystSource =
      sources.has("SEC_INSIDER") || sources.has("OPTIONS_FLOW") || sources.has("CONGRESS");
    const computedRec = deriveRecommendation({
      aiScore,
      stage,
      sourceCount: agg.sourceCount,
      hasCatalystSource,
      pndFlagged,
      price: fundamentals?.price ?? null,
      medianSignalAgeHrs: agg.medianSignalAgeHrs,
    });
    report.recommendation = computedRec;

    if (report.tradeSetup && !recommendationHasTradeSetup(computedRec)) {
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
```

Update `defaultReport` to also produce a deterministic value when the LLM call entirely fails (still Watch — no data means we can't justify Buy):

```typescript
function defaultReport(
  symbol: string,
  _agg?: AggregatedSymbol,
  _fundamentals?: FundamentalData | null,
  _aiScore?: number,
  _stage?: TickerStage,
): TickerReport {
  return {
    catalyst: "Unable to determine catalyst — AI analysis unavailable.",
    risks: "Full risk assessment unavailable. Exercise caution.",
    recommendation: "Watch",
    report: `Signal detected for ${symbol} but AI analysis could not be completed. Manual review recommended.`,
  };
}
```

- [ ] **Step 3: Update the three API callers to pass `pndFlagged`**

```bash
grep -n "generateTickerReportReACT(" src/app/api/tickers/\[symbol\]/report/route.ts src/app/api/reports/generate/route.ts src/app/api/alerts/send/route.ts
```

For each call site, add the `pndFlagged` argument. The value is on the `ValidatedTicker` row already being read. Example for `src/app/api/tickers/[symbol]/report/route.ts:55`:

```typescript
const tickerReport = await generateTickerReportReACT(
  ticker.symbol,
  reconstructed.agg,
  reconstructed.fundamentals,
  ticker.aiScore ?? 0,
  ticker.scanId,
  signalType,
  reconstructed.novelty,
  { trigger: "api", scanId: ticker.scanId },
  ticker.stage,
  ticker.pndFlagged ?? false,  // NEW
);
```

Verify each route already selects `pndFlagged`; if not, add it to the `select` block.

- [ ] **Step 4: Run the report-react tests**

```bash
npx vitest run src/__tests__/report-react.test.ts
```

Expected: Some assertions may now fail because the test fixtures had the LLM return a specific recommendation that no longer matches the deterministic rule. Update fixtures in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/harvester/report.ts src/app/api/tickers/\[symbol\]/report/route.ts src/app/api/reports/generate/route.ts src/app/api/alerts/send/route.ts
git commit -m "Compute recommendation deterministically in report pipeline"
```

---

## Task 4: Update existing report tests

`src/__tests__/report-react.test.ts` pins LLM-returned `recommendation: "Buy"` to verify pass-through. With the deterministic override the test fixture needs to align inputs so the rule also picks `Buy`, OR the assertion needs to accept whatever the rule picks.

**Files:**
- Modify: `src/__tests__/report-react.test.ts`

- [ ] **Step 1: Open and inspect the test file**

```bash
wc -l src/__tests__/report-react.test.ts
grep -n "recommendation" src/__tests__/report-react.test.ts
```

- [ ] **Step 2: Update the test fixture so the inputs satisfy the deterministic Buy rule**

For each test case where the LLM mock returns `recommendation: "Buy"`, make sure the test passes `aiScore ≥ 60`, `stage: "CONFIRMED"` (or `FORMING` + `sourceCount: 2`), and `pndFlagged: false`. If the test was specifically asserting the LLM's choice is preserved, change the assertion to `expect(report.recommendation).toBe("Buy")` because the rule now produces it — but document why (deterministic, not pass-through).

For tests where the LLM returns `recommendation: "Strong Buy"`, ensure inputs include `stage: "CONFIRMED"`, `hasCatalystSource` (signal source includes `SEC_INSIDER`), `sourceCount ≥ 3`, `aiScore ≥ 70`, `medianSignalAgeHrs ≤ 6`.

If a test exists that asserts the LLM's `recommendation` overrides the rule, delete it — that contract is gone.

- [ ] **Step 3: Run the updated tests**

```bash
npx vitest run src/__tests__/report-react.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite to catch other regressions**

```bash
npm test -- --run
```

Expected: PASS. If any test in `src/__tests__/` was indirectly relying on AI choosing Watch (e.g. `defaultReport` shape), update it.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/report-react.test.ts
git commit -m "Update report tests to match deterministic recommendation rule"
```

---

## Task 5: Update methodology copy

Public-facing copy at `src/lib/methodology-data.ts` currently describes recommendations as AI guidance. Update to describe the deterministic rule in plain English (per `feedback_explain_jargon_public` memory).

**Files:**
- Modify: `src/lib/methodology-data.ts`

- [ ] **Step 1: Replace `recommendationLevels` array**

Open `src/lib/methodology-data.ts` at line 149 and replace each `desc` field:

```typescript
export const recommendationLevels: RecommendationLevel[] = [
  {
    level: "Strong Buy",
    color: "bg-green-600 text-white dark:bg-green-700 dark:text-white",
    desc: "CONFIRMED stage with a verifiable catalyst (insider buy, congressional trade, or unusual options flow), 3+ sources of corroboration, AI score ≥ 70, and fresh signals (median age ≤ 6h). Rare.",
  },
  {
    level: "Buy",
    color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    desc: "Either CONFIRMED stage with AI score ≥ 60, a verifiable catalyst with 2+ sources and AI score ≥ 55, or FORMING stage with 2+ sources and AI score ≥ 60.",
  },
  {
    level: "Watch",
    color: "bg-yellow-100 text-yellow-800 dark:bg-amber-950/40 dark:text-amber-300",
    desc: "Interesting signal but does not yet meet the Buy thresholds. Default label.",
  },
  {
    level: "Avoid",
    color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    desc: "Flagged by the pump-and-dump filter, sub-$0.12 price, or AI score < 20 without any catalyst source.",
  },
];
```

Also update `scoringDescription` (around line 185) to mention that recommendations are now rule-based:

```typescript
export const scoringDescription =
  "Each candidate is scored by AI using source weights, catalyst quality, novelty, and " +
  "cross-source corroboration. Pure social signals (Reddit / StockTwits / Twitter only) " +
  "are hard-capped at 50 — this is enforced programmatically regardless of what the AI " +
  "returns. Only tickers with a verifiable catalyst source (SEC Insider, Congress, or Options Flow) " +
  "can exceed 50. The final recommendation label (Strong Buy / Buy / Watch / Avoid) is then " +
  "derived from a deterministic rule over the score, stage, source mix, catalyst presence, " +
  "and pump-and-dump flags — the AI does not choose it.";
```

If the existing `scoringDescription` ends differently, append the final sentence to whatever text is currently there. Read the file first to see the exact closing punctuation.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/methodology-data.ts
git commit -m "Document deterministic recommendation rule on methodology page"
```

---

## Task 6: Update changelog

Per `CLAUDE.md`, every shipped change goes in `src/lib/changelog-data.ts`.

**Files:**
- Modify: `src/lib/changelog-data.ts`

- [ ] **Step 1: Read the top of changelog-data.ts**

```bash
head -40 src/lib/changelog-data.ts
```

Confirm date format. Today is 2026-05-22. CLAUDE.md says: one entry per date — merge into the existing 2026-05-22 entry if one exists, otherwise add a new entry at the top.

- [ ] **Step 2: Add or merge entry**

Add the following bullet to the 2026-05-22 entry (merge into existing if present):

```
- **Deterministic Buy/Watch recommendations** — The Strong Buy / Buy / Watch / Avoid label is now derived from a rule over AI score, stage, source mix, catalyst presence, and P&D flags. The AI still writes the narrative (catalyst, risks, analysis) but no longer picks the label, removing drift between the score and the recommendation.
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/changelog-data.ts
git commit -m "Changelog: deterministic recommendation rule"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test run**

```bash
npm test -- --run
```

Expected: PASS, including the 14 new `recommendation.test.ts` tests.

- [ ] **Step 2: Type check / build**

```bash
npm run build
```

Expected: PASS. If any caller of `generateTickerReport` was missed, TypeScript will flag the missing `pndFlagged` argument here. Fix and re-run.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Smoke check — manually exercise the report endpoint locally**

```bash
npm run dev &
DEV_PID=$!
sleep 5
# Pick any recent ticker with a stored report
curl -s "http://localhost:3000/api/tickers/AAPL/report" | jq '.recommendation'
kill $DEV_PID
```

Expected: a value in `{"Strong Buy", "Buy", "Watch", "Avoid"}` matching what `deriveRecommendation` would produce for that row's stage/aiScore/sources.

- [ ] **Step 5: Final commit if anything came up in verification**

```bash
git status
# If clean, no-op. Otherwise commit and move on.
```

---

## Self-review notes

- All four recommendation labels are still reachable from the rule.
- The `tradeSetup` rule (`Buy`/`Strong Buy` only) is enforced server-side rather than via prompt — closes the prior gap where the LLM could say `Watch` but still emit a trade setup, or say `Buy` without one.
- Forward-only per user choice: no migration script touches existing rows.
- `RECOMMENDATION_RULE_VERSION = 1` constant lets a future change log when the rule semantics shifted (e.g. for backtest replay).
- The LLM prompt no longer claims to choose the recommendation, removing the implicit contract.
- The existing `applyAnchoredBracket` (target/stop math) is unchanged; it still computes per-stage from realized P90 returns.
