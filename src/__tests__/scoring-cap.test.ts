import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AggregatedSymbol } from "@/lib/harvester/types";

// Mock the AI module to return inflated scores for social-only tickers
const chatJSONMock = vi.fn();
vi.mock("@/lib/ai", () => ({
  chatJSON: chatJSONMock,
}));

const { scoreSymbolBatch } = await import("@/lib/harvester/scoring");

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

describe("scoreSymbolBatch — post-AI social-only cap enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps social-only ticker at 50 even when AI returns 80", async () => {
    chatJSONMock.mockResolvedValueOnce({
      content: JSON.stringify({
        scores: [{ symbol: "HYPE", score: 80, sentiment: "bullish", reasoning: "AI thinks its hot" }],
      }),
    });

    const agg = makeAgg({
      symbol: "HYPE",
      signals: [
        { symbol: "HYPE", source: "REDDIT", title: "HYPE to the moon" },
        { symbol: "HYPE", source: "STOCKTWITS", title: "HYPE trending" },
      ],
      sourceCount: 2,
    });

    const [result] = await scoreSymbolBatch([agg]);
    expect(result.score).toBeLessThanOrEqual(50);
  });

  it("allows insider source ticker above 50 when AI returns 80", async () => {
    chatJSONMock.mockResolvedValueOnce({
      content: JSON.stringify({
        scores: [{ symbol: "LEGIT", score: 80, sentiment: "bullish", reasoning: "Strong insider buy" }],
      }),
    });

    const agg = makeAgg({
      symbol: "LEGIT",
      signals: [
        { symbol: "LEGIT", source: "SEC_INSIDER", title: "CEO buys $1M" },
        { symbol: "LEGIT", source: "REDDIT", title: "LEGIT insider activity" },
      ],
      sourceCount: 2,
    });

    const [result] = await scoreSymbolBatch([agg]);
    expect(result.score).toBe(80);
  });

  it("allows options flow ticker above 50 when AI returns 70", async () => {
    chatJSONMock.mockResolvedValueOnce({
      content: JSON.stringify({
        scores: [{ symbol: "OPTS", score: 70, sentiment: "bullish", reasoning: "Unusual call volume" }],
      }),
    });

    const agg = makeAgg({
      symbol: "OPTS",
      signals: [
        { symbol: "OPTS", source: "OPTIONS_FLOW", title: "Unusual calls" },
      ],
      sourceCount: 1,
    });

    const [result] = await scoreSymbolBatch([agg]);
    expect(result.score).toBe(70);
  });

  it("caps Twitter-only ticker at 50", async () => {
    chatJSONMock.mockResolvedValueOnce({
      content: JSON.stringify({
        scores: [{ symbol: "TWIT", score: 65, sentiment: "bullish", reasoning: "Viral tweet" }],
      }),
    });

    const agg = makeAgg({
      symbol: "TWIT",
      signals: [
        { symbol: "TWIT", source: "TWITTER", title: "TWIT breaking out" },
        { symbol: "TWIT", source: "TWITTER", title: "TWIT going viral" },
      ],
      sourceCount: 1,
    });

    const [result] = await scoreSymbolBatch([agg]);
    expect(result.score).toBeLessThanOrEqual(50);
  });

  it("VOLUME_SPIKE alone does not bypass social cap (not a catalyst source)", async () => {
    chatJSONMock.mockResolvedValueOnce({
      content: JSON.stringify({
        scores: [{ symbol: "VOL", score: 60, sentiment: "neutral", reasoning: "Volume spike" }],
      }),
    });

    const agg = makeAgg({
      symbol: "VOL",
      signals: [
        { symbol: "VOL", source: "VOLUME_SPIKE", title: "2x volume" },
      ],
      sourceCount: 1,
    });

    const [result] = await scoreSymbolBatch([agg]);
    expect(result.score).toBeLessThanOrEqual(50);
  });
});
