import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AggregatedSymbol, NoveltyContext } from "@/lib/harvester/types";

// Mock the AI module so scoreSymbolBatch falls back to the heuristic defaultScore
vi.mock("@/lib/ai", () => ({
  chatJSON: vi.fn().mockRejectedValue(new Error("AI unavailable")),
}));

// Import after mocking
const { scoreSymbolBatch } = await import("@/lib/harvester/scoring");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAgg(overrides: Partial<AggregatedSymbol> = {}): AggregatedSymbol {
  return {
    symbol: "TEST",
    signals: [],
    sourceCount: 1,
    weightedSourceScore: 1,
    subredditCount: 1,
    totalUpvotes: 10,
    totalComments: 5,
    avgVelocity: 1,
    momentum: {
      risingCount: 0,
      freshCount: 1,
      recentCount: 0,
      commentDerivedCount: 0,
      staleCount: 0,
    },
    medianSignalAgeHrs: null,
    ...overrides,
  };
}

function makeNovelty(overrides: Partial<NoveltyContext> = {}): NoveltyContext {
  return {
    firstSeenAt: new Date(),
    daysSinceFirstSeen: 0,
    priorAppearances: 0,
    isNovel: true,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("scoreSymbolBatch — heuristic fallback (AI mocked to fail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty input", async () => {
    const result = await scoreSymbolBatch([]);
    expect(result).toEqual([]);
  });

  it("returns a score for each symbol", async () => {
    const symbols = [makeAgg({ symbol: "PTON" }), makeAgg({ symbol: "PLTR" })];
    const result = await scoreSymbolBatch(symbols);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.symbol)).toEqual(["PTON", "PLTR"]);
  });

  it("score is in range 0-100", async () => {
    const result = await scoreSymbolBatch([makeAgg()]);
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(100);
  });

  it("social-only score caps at 50", async () => {
    const agg = makeAgg({
      sourceCount: 5,
      totalUpvotes: 10000,
      totalComments: 5000,
      avgVelocity: 3,
    });
    const result = await scoreSymbolBatch([agg]);
    expect(result[0].score).toBeLessThanOrEqual(50);
  });

  it("insider signal raises score above social-only cap", async () => {
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "SEC_INSIDER", title: "CEO buys" },
      ],
      sourceCount: 1,
    });
    const result = await scoreSymbolBatch([agg]);
    // hasInsider=true → base 55; should score higher than social-only cap of 50
    expect(result[0].score).toBeGreaterThan(50);
  });

  it("multi-source with insider scores higher", async () => {
    const aggInsiderOnly = makeAgg({
      signals: [{ symbol: "TEST", source: "SEC_INSIDER" }],
      sourceCount: 1,
    });
    const aggMulti = makeAgg({
      signals: [
        { symbol: "TEST", source: "SEC_INSIDER" },
        { symbol: "TEST", source: "REDDIT" },
        { symbol: "TEST", source: "TWITTER" },
      ],
      sourceCount: 3,
    });
    const [insiderResult] = await scoreSymbolBatch([aggInsiderOnly]);
    const [multiResult] = await scoreSymbolBatch([aggMulti]);
    expect(multiResult.score).toBeGreaterThanOrEqual(insiderResult.score);
  });

  it("novel ticker gets a score boost vs non-novel", async () => {
    const agg = makeAgg();
    const novelty = makeNovelty({ isNovel: true });
    const noveltyMap = new Map([["TEST", novelty]]);

    const [withNovelty] = await scoreSymbolBatch([agg], undefined, noveltyMap);
    const [withoutNovelty] = await scoreSymbolBatch([agg]);

    expect(withNovelty.score).toBeGreaterThanOrEqual(withoutNovelty.score);
  });

  it("stale ticker (3+ appearances) gets a penalty", async () => {
    const agg = makeAgg();
    const staleNovelty = makeNovelty({ isNovel: false, priorAppearances: 5, daysSinceFirstSeen: 10 });
    const noNovelty = makeNovelty({ isNovel: false, priorAppearances: 1, daysSinceFirstSeen: 1 });

    const staleMap = new Map([["TEST", staleNovelty]]);
    const freshMap = new Map([["TEST", noNovelty]]);

    const [stale] = await scoreSymbolBatch([agg], undefined, staleMap);
    const [fresh] = await scoreSymbolBatch([agg], undefined, freshMap);

    expect(stale.score).toBeLessThanOrEqual(fresh.score);
  });

  it("higher velocity produces a higher score (social-only)", async () => {
    const lowVel = makeAgg({ avgVelocity: 0.5 });
    const highVel = makeAgg({ avgVelocity: 3 });

    const [low] = await scoreSymbolBatch([lowVel]);
    const [high] = await scoreSymbolBatch([highVel]);

    // Both capped at 50, but high velocity should score >= low
    expect(high.score).toBeGreaterThanOrEqual(low.score);
  });

  it("returns neutral sentiment on heuristic fallback", async () => {
    const result = await scoreSymbolBatch([makeAgg()]);
    expect(result[0].sentiment).toBe("neutral");
  });

  it("reasoning mentions heuristic fallback", async () => {
    const result = await scoreSymbolBatch([makeAgg()]);
    expect(result[0].reasoning.toLowerCase()).toContain("heuristic");
  });

  it("options flow signal raises score above social-only", async () => {
    const agg = makeAgg({
      signals: [{ symbol: "TEST", source: "OPTIONS_FLOW" }],
      sourceCount: 1,
    });
    const result = await scoreSymbolBatch([agg]);
    expect(result[0].score).toBeGreaterThanOrEqual(50);
  });

  it("very stale signals (>12h) get a score penalty", async () => {
    const fresh = makeAgg({ medianSignalAgeHrs: 1 });
    const stale = makeAgg({ medianSignalAgeHrs: 15 });

    const [freshResult] = await scoreSymbolBatch([fresh]);
    const [staleResult] = await scoreSymbolBatch([stale]);

    expect(staleResult.score).toBeLessThan(freshResult.score);
  });

  it("moderately stale signals (6-12h) get a smaller penalty", async () => {
    const fresh = makeAgg({ medianSignalAgeHrs: 1 });
    const moderate = makeAgg({ medianSignalAgeHrs: 8 });
    const veryStale = makeAgg({ medianSignalAgeHrs: 15 });

    const [freshResult] = await scoreSymbolBatch([fresh]);
    const [modResult] = await scoreSymbolBatch([moderate]);
    const [staleResult] = await scoreSymbolBatch([veryStale]);

    expect(modResult.score).toBeLessThan(freshResult.score);
    expect(modResult.score).toBeGreaterThanOrEqual(staleResult.score);
  });

  it("null medianSignalAgeHrs gets no staleness penalty", async () => {
    const noAge = makeAgg({ medianSignalAgeHrs: null });
    const fresh = makeAgg({ medianSignalAgeHrs: 1 });

    const [noAgeResult] = await scoreSymbolBatch([noAge]);
    const [freshResult] = await scoreSymbolBatch([fresh]);

    expect(noAgeResult.score).toBe(freshResult.score);
  });
});
