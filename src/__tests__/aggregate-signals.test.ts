import { describe, it, expect, vi } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";

// Mock all external deps pulled in by harvester/index.ts
vi.mock("@/lib/prisma", () => ({ prisma: {}, createDevPrismaClient: vi.fn() }));
vi.mock("@/lib/harvester/sources/reddit", () => ({ fetchRedditSignals: vi.fn() }));
vi.mock("@/lib/harvester/sources/stocktwits", () => ({ fetchStockTwitsSignals: vi.fn() }));
vi.mock("@/lib/harvester/sources/sec-insider", () => ({ fetchSecInsiderSignals: vi.fn() }));
vi.mock("@/lib/harvester/sources/options-flow", () => ({ fetchOptionsFlowSignals: vi.fn() }));
vi.mock("@/lib/harvester/sources/volume-spike", () => ({ fetchVolumeSpikeSignals: vi.fn() }));
vi.mock("@/lib/harvester/sources/twitter", () => ({ fetchTwitterSignals: vi.fn() }));
vi.mock("@/lib/harvester/scoring", () => ({ scoreSymbolBatch: vi.fn() }));
vi.mock("@/lib/harvester/pnd-filter", () => ({ checkPndFlags: vi.fn(), aiPndAssessment: vi.fn(), PND_THRESHOLD: 3, INFORMATIONAL_FLAGS: new Set(["penny_price", "otc_listing", "twitter_coordinated_pump", "coordinated_posts", "single_source"]) }));
vi.mock("@/lib/harvester/fundamentals", () => ({ fetchFundamentals: vi.fn() }));
vi.mock("@/lib/harvester/report", () => ({ generateTickerReport: vi.fn() }));
vi.mock("@/lib/ai", () => ({
  resetCostTracker: vi.fn(),
  getTotalCost: vi.fn(() => 0),
  chatJSON: vi.fn(),
}));

const { aggregateSignals, resolveFlairWeight } = await import("@/lib/harvester/index");

// ── Helpers ───────────────────────────────────────────────────────────────────

function sig(symbol: string, overrides: Partial<RawSignal> = {}): RawSignal {
  return { symbol, source: "REDDIT", ...overrides };
}

// ── Grouping ──────────────────────────────────────────────────────────────────

describe("aggregateSignals — grouping", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateSignals([])).toEqual([]);
  });

  it("groups signals by symbol", () => {
    const signals = [sig("PTON"), sig("PTON"), sig("PLTR")];
    const result = aggregateSignals(signals);
    expect(result).toHaveLength(2);
    const pton = result.find((r) => r.symbol === "PTON")!;
    expect(pton.signals).toHaveLength(2);
  });

  it("preserves all signal data per symbol", () => {
    const signals = [
      sig("PTON", { title: "First" }),
      sig("PTON", { title: "Second" }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.signals.map((s) => s.title)).toEqual(["First", "Second"]);
  });
});

// ── sourceCount & weightedSourceScore ─────────────────────────────────────────

describe("aggregateSignals — sourceCount & weightedSourceScore", () => {
  it("counts unique sources", () => {
    const signals = [
      sig("PTON", { source: "REDDIT" }),
      sig("PTON", { source: "REDDIT" }),
      sig("PTON", { source: "TWITTER" }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.sourceCount).toBe(2);
  });

  it("weights sources correctly (SEC_INSIDER=3, OPTIONS_FLOW=2.5, VOLUME_SPIKE=2.5, REDDIT=1)", () => {
    const signals = [
      sig("PTON", { source: "SEC_INSIDER" }),
      sig("PTON", { source: "OPTIONS_FLOW" }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBe(3 + 2.5); // 5.5
  });

  it("assigns weight 1 to unknown sources", () => {
    const signals = [sig("PTON", { source: "STOCKTWITS" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBe(1);
  });

  it("weights VOLUME_SPIKE at 2.5", () => {
    const signals = [sig("PTON", { source: "VOLUME_SPIKE" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBe(2.5);
  });
});

// ── subredditCount ────────────────────────────────────────────────────────────

describe("aggregateSignals — subredditCount", () => {
  it("counts unique subreddits from REDDIT signals", () => {
    const signals = [
      sig("PTON", { source: "REDDIT", subreddit: "wallstreetbets" }),
      sig("PTON", { source: "REDDIT", subreddit: "stocks" }),
      sig("PTON", { source: "REDDIT", subreddit: "wallstreetbets" }), // duplicate
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.subredditCount).toBe(2);
  });

  it("ignores non-REDDIT signals for subredditCount", () => {
    const signals = [
      sig("PTON", { source: "TWITTER", subreddit: "whatever" }),
      sig("PTON", { source: "REDDIT", subreddit: "stocks" }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.subredditCount).toBe(1);
  });

  it("is 0 when no Reddit signals have subreddits", () => {
    const signals = [sig("PTON", { source: "REDDIT" })]; // no subreddit field
    const [agg] = aggregateSignals(signals);
    expect(agg.subredditCount).toBe(0);
  });
});

// ── totalUpvotes & totalComments ──────────────────────────────────────────────

describe("aggregateSignals — totalUpvotes & totalComments", () => {
  it("sums upvotes across all signals", () => {
    const signals = [
      sig("PTON", { upvotes: 100 }),
      sig("PTON", { upvotes: 50 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.totalUpvotes).toBe(150);
  });

  it("sums commentCount across all signals", () => {
    const signals = [
      sig("PTON", { commentCount: 20 }),
      sig("PTON", { commentCount: 30 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.totalComments).toBe(50);
  });

  it("treats missing upvotes/comments as 0", () => {
    const signals = [sig("PTON"), sig("PTON", { upvotes: 10 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.totalUpvotes).toBe(10);
  });
});

// ── avgVelocity ───────────────────────────────────────────────────────────────

describe("aggregateSignals — avgVelocity", () => {
  it("assigns 3 for rising sortType", () => {
    const signals = [sig("PTON", { sortType: "rising", postAge: 5 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(3);
  });

  it("assigns 1.5 for comment sortType", () => {
    const signals = [sig("PTON", { sortType: "comment", postAge: 5 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(1.5);
  });

  it("assigns 2 for postAge < 3 (new sortType, not rising/comment)", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 1 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(2);
  });

  it("assigns 1 for postAge 3-11 hours", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 6 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(1);
  });

  it("assigns 0.5 for postAge >= 12", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 24 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(0.5);
  });

  it("returns 0 when postAge or sortType is missing on all signals", () => {
    const signals = [sig("PTON"), sig("PTON", { postAge: 1 })]; // second missing sortType
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(0); // no social signals with velocity data
  });

  it("averages velocity across only social signals (excludes non-social)", () => {
    const signals = [
      sig("PTON", { sortType: "rising", postAge: 1 }), // 3
      sig("PTON", { sortType: "new", postAge: 6 }),    // 1
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(2); // (3 + 1) / 2
  });

  it("excludes non-social signals from velocity average denominator", () => {
    const signals = [
      sig("PTON", { source: "REDDIT", sortType: "rising", postAge: 1 }),  // velocity 3
      sig("PTON", { source: "SEC_INSIDER" }),                              // no postAge/sortType
    ];
    const [agg] = aggregateSignals(signals);
    // Previously: (3 + 0) / 2 = 1.5, now: 3 / 1 = 3
    expect(agg.avgVelocity).toBe(3);
  });

  it("assigns 1.5 for trending sortType (StockTwits)", () => {
    const signals = [sig("PTON", { source: "STOCKTWITS", sortType: "trending", postAge: 0 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(1.5);
  });

  it("trending signals do not inflate velocity like rising does", () => {
    const risingSignals = [sig("PTON", { sortType: "rising", postAge: 0 })];
    const trendingSignals = [sig("PTON", { sortType: "trending", postAge: 0 })];
    const [rising] = aggregateSignals(risingSignals);
    const [trending] = aggregateSignals(trendingSignals);
    expect(rising.avgVelocity).toBe(3);
    expect(trending.avgVelocity).toBe(1.5);
    expect(trending.avgVelocity).toBeLessThan(rising.avgVelocity);
  });
});

// ── momentum ──────────────────────────────────────────────────────────────────

describe("aggregateSignals — momentum breakdown", () => {
  it("counts rising signals", () => {
    const signals = [
      sig("PTON", { sortType: "rising", postAge: 5 }),
      sig("PTON", { sortType: "rising", postAge: 2 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.risingCount).toBe(2);
  });

  it("counts fresh signals (postAge < 3, not rising/comment)", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 1 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.freshCount).toBe(1);
  });

  it("counts recent signals (postAge 3-11)", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 8 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.recentCount).toBe(1);
  });

  it("counts stale signals (postAge >= 12)", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 24 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.staleCount).toBe(1);
  });

  it("counts comment-derived signals", () => {
    const signals = [sig("PTON", { sortType: "comment", postAge: 6 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.commentDerivedCount).toBe(1);
  });

  it("ignores signals with missing postAge or sortType", () => {
    const signals = [sig("PTON")];
    const [agg] = aggregateSignals(signals);
    const m = agg.momentum;
    expect(m.risingCount + m.freshCount + m.recentCount + m.staleCount + m.commentDerivedCount).toBe(0);
  });
});

// ── medianSignalAgeHrs ───────────────────────────────────────────────────────

describe("aggregateSignals — medianSignalAgeHrs", () => {
  it("computes median of signal postAge values", () => {
    const signals = [
      sig("PTON", { postAge: 2 }),
      sig("PTON", { postAge: 8 }),
      sig("PTON", { postAge: 14 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.medianSignalAgeHrs).toBe(8);
  });

  it("averages two middle values for even count", () => {
    const signals = [
      sig("PTON", { postAge: 2 }),
      sig("PTON", { postAge: 10 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.medianSignalAgeHrs).toBe(6); // (2 + 10) / 2
  });

  it("returns null when no signals have postAge", () => {
    const signals = [sig("PTON"), sig("PTON")];
    const [agg] = aggregateSignals(signals);
    expect(agg.medianSignalAgeHrs).toBeNull();
  });

  it("ignores signals without postAge when computing median", () => {
    const signals = [
      sig("PTON", { postAge: 4 }),
      sig("PTON"), // no postAge
      sig("PTON", { postAge: 10 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.medianSignalAgeHrs).toBe(7); // (4 + 10) / 2
  });

  it("returns exact value for single signal", () => {
    const signals = [sig("PTON", { postAge: 5 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.medianSignalAgeHrs).toBe(5);
  });
});

// ── candidate filter (weightedSourceScore >= 2) ──────────────────────────────

describe("aggregateSignals — high-value single source bypass", () => {
  it("SEC_INSIDER single signal has weightedSourceScore >= 2 (passes candidate filter)", () => {
    const signals = [sig("PTON", { source: "SEC_INSIDER" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBeGreaterThanOrEqual(2);
    expect(agg.signals).toHaveLength(1);
    expect(agg.sourceCount).toBe(1);
  });

  it("VOLUME_SPIKE single signal has weightedSourceScore >= 2 (passes candidate filter)", () => {
    const signals = [sig("PTON", { source: "VOLUME_SPIKE" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBeGreaterThanOrEqual(2);
  });

  it("OPTIONS_FLOW single signal has weightedSourceScore >= 2 (passes candidate filter)", () => {
    const signals = [sig("PTON", { source: "OPTIONS_FLOW" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBeGreaterThanOrEqual(2);
  });

  it("single REDDIT signal has weightedSourceScore < 2 (filtered out)", () => {
    const signals = [sig("PTON", { source: "REDDIT" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBeLessThan(2);
  });

  it("single STOCKTWITS signal has weightedSourceScore < 2 (filtered out)", () => {
    const signals = [sig("PTON", { source: "STOCKTWITS" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.weightedSourceScore).toBeLessThan(2);
  });
});

// ── sorting ───────────────────────────────────────────────────────────────────

describe("aggregateSignals — sorting", () => {
  it("sorts by sourceCount descending", () => {
    const signals = [
      sig("PTON", { source: "REDDIT" }),
      sig("PLTR", { source: "REDDIT" }),
      sig("PLTR", { source: "TWITTER" }),
    ];
    const result = aggregateSignals(signals);
    expect(result[0].symbol).toBe("PLTR");
    expect(result[1].symbol).toBe("PTON");
  });

  it("breaks sourceCount ties by signal count descending", () => {
    const signals = [
      sig("PTON", { source: "REDDIT" }),
      sig("PLTR", { source: "REDDIT" }),
      sig("PLTR", { source: "REDDIT" }),
    ];
    const result = aggregateSignals(signals);
    // Both have sourceCount=1 but PLTR has 2 signals
    expect(result[0].symbol).toBe("PLTR");
  });
});

// ── hot sortType ──────────────────────────────────────────────────────────────

describe("aggregateSignals — hot sortType", () => {
  it("assigns velocity 2 for hot sortType", () => {
    const signals = [sig("PTON", { sortType: "hot", postAge: 5 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(2);
  });

  it("hot velocity is between rising (3) and comment (1.5)", () => {
    const [rising] = aggregateSignals([sig("PTON", { sortType: "rising", postAge: 5 })]);
    const [hot] = aggregateSignals([sig("PTON", { sortType: "hot", postAge: 5 })]);
    const [comment] = aggregateSignals([sig("PTON", { sortType: "comment", postAge: 5 })]);
    expect(hot.avgVelocity).toBeLessThan(rising.avgVelocity);
    expect(hot.avgVelocity).toBeGreaterThan(comment.avgVelocity);
  });

  it("counts hot signals in risingCount for momentum", () => {
    const signals = [
      sig("PTON", { sortType: "hot", postAge: 2 }),
      sig("PTON", { sortType: "rising", postAge: 1 }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.momentum.risingCount).toBe(2);
  });
});

// ── resolveFlairWeight ────────────────────────────────────────────────────────

describe("resolveFlairWeight", () => {
  it("returns 1.5 for DD flair", () => {
    expect(resolveFlairWeight("DD")).toBe(1.5);
  });

  it("returns 1.5 for Due Diligence flair (case-insensitive)", () => {
    expect(resolveFlairWeight("Due Diligence")).toBe(1.5);
  });

  it("returns 1.4 for News flair", () => {
    expect(resolveFlairWeight("News")).toBe(1.4);
  });

  it("returns 1.4 for Breaking News flair", () => {
    expect(resolveFlairWeight("Breaking News")).toBe(1.4);
  });

  it("returns 1.2 for Technical Analysis flair", () => {
    expect(resolveFlairWeight("Technical Analysis")).toBe(1.2);
  });

  it("returns 0.8 for YOLO flair", () => {
    expect(resolveFlairWeight("YOLO")).toBe(0.8);
  });

  it("returns 0.6 for Gain flair", () => {
    expect(resolveFlairWeight("Gain")).toBe(0.6);
  });

  it("returns 0.6 for Loss flair", () => {
    expect(resolveFlairWeight("Loss")).toBe(0.6);
  });

  it("returns 0.5 for Meme flair", () => {
    expect(resolveFlairWeight("Meme")).toBe(0.5);
  });

  it("returns 0.5 for Shitpost flair", () => {
    expect(resolveFlairWeight("Shitpost")).toBe(0.5);
  });

  it("returns 0.4 for Daily Discussion flair", () => {
    expect(resolveFlairWeight("Daily Discussion")).toBe(0.4);
  });

  it("returns 0.4 for Weekend Thread flair", () => {
    expect(resolveFlairWeight("Weekend Thread")).toBe(0.4);
  });

  it("returns 1.0 for undefined flair", () => {
    expect(resolveFlairWeight(undefined)).toBe(1.0);
  });

  it("returns 1.0 for unrecognized flair", () => {
    expect(resolveFlairWeight("Question")).toBe(1.0);
  });

  it("is case-insensitive", () => {
    expect(resolveFlairWeight("dd")).toBe(1.5);
    expect(resolveFlairWeight("MEME")).toBe(0.5);
    expect(resolveFlairWeight("daily discussion")).toBe(0.4);
  });

  it("matches first category when flair could match multiple", () => {
    // "DD / Research" matches DD (1.5) before Research (also 1.5)
    expect(resolveFlairWeight("DD / Research")).toBe(1.5);
  });
});

// ── flair × velocity integration ─────────────────────────────────────────────

describe("aggregateSignals — flair velocity weighting", () => {
  it("DD flair boosts rising velocity: 3 × 1.5 = 4.5", () => {
    const signals = [sig("PTON", { sortType: "rising", postAge: 5, flair: "DD" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(4.5);
  });

  it("Meme flair reduces rising velocity: 3 × 0.5 = 1.5", () => {
    const signals = [sig("PTON", { sortType: "rising", postAge: 5, flair: "Meme" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(1.5);
  });

  it("News flair boosts hot velocity: 2 × 1.4 = 2.8", () => {
    const signals = [sig("PTON", { sortType: "hot", postAge: 5, flair: "News" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBeCloseTo(2.8);
  });

  it("Daily Discussion flair reduces fresh new velocity: 2 × 0.4 = 0.8", () => {
    const signals = [sig("PTON", { sortType: "new", postAge: 1, flair: "Daily Discussion" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBeCloseTo(0.8);
  });

  it("undefined flair uses neutral weight (1.0)", () => {
    const signals = [sig("PTON", { sortType: "rising", postAge: 5 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(3); // 3 × 1.0
  });

  it("averages flair-weighted velocities across multiple signals", () => {
    const signals = [
      sig("PTON", { sortType: "rising", postAge: 1, flair: "DD" }),        // 3 × 1.5 = 4.5
      sig("PTON", { sortType: "new", postAge: 6, flair: "Meme" }),         // 1 × 0.5 = 0.5
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.avgVelocity).toBe(2.5); // (4.5 + 0.5) / 2
  });
});

// ── Net premium ──────────────────────────────────────────────────────────────

describe("aggregateSignals — net premium", () => {
  it("surfaces netPremium from OPTIONS_FLOW signal", () => {
    const signals = [sig("PTON", { source: "OPTIONS_FLOW", netPremium: 500000, callPremiumRatio: 0.72 })];
    const [agg] = aggregateSignals(signals);
    expect(agg.netPremium).toBe(500000);
    expect(agg.callPremiumRatio).toBe(0.72);
  });

  it("returns undefined netPremium when no OPTIONS_FLOW signal", () => {
    const signals = [sig("PTON", { source: "REDDIT" })];
    const [agg] = aggregateSignals(signals);
    expect(agg.netPremium).toBeUndefined();
    expect(agg.callPremiumRatio).toBeUndefined();
  });

  it("picks OPTIONS_FLOW netPremium even among mixed sources", () => {
    const signals = [
      sig("PTON", { source: "REDDIT" }),
      sig("PTON", { source: "OPTIONS_FLOW", netPremium: -200000, callPremiumRatio: 0.35 }),
      sig("PTON", { source: "VOLUME_SPIKE" }),
    ];
    const [agg] = aggregateSignals(signals);
    expect(agg.netPremium).toBe(-200000);
    expect(agg.callPremiumRatio).toBe(0.35);
  });
});
