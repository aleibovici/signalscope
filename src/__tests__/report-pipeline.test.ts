import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatJSONRequest, ChatJSONResponse } from "@/lib/ai/types";
import type { AggregatedSymbol, FundamentalData } from "@/lib/harvester/types";
import { TickerStage } from "@/generated/prisma/client";

const mockChatJSON = vi.fn<(req: ChatJSONRequest) => Promise<ChatJSONResponse>>();
vi.mock("@/lib/ai", () => ({
  chatJSON: (req: ChatJSONRequest) => mockChatJSON(req),
}));

vi.mock("@/lib/harvester/report-tools", () => ({
  TOOL_REGISTRY: {},
  TOOL_DEFINITIONS: [],
}));

const mockResolveTradeBracket = vi.fn();
vi.mock("@/lib/anchors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anchors")>("@/lib/anchors");
  return {
    ...actual,
    resolveTradeBracket: (...args: unknown[]) => mockResolveTradeBracket(...args),
  };
});

const { generateTickerReport, generateTickerReportReACT } = await import("@/lib/harvester/report");

const fundamentals: FundamentalData = {
  price: 10,
  marketCap: 500_000_000,
  shortFloat: 0.08,
  fiftyTwoWeekRange: "6.00 - 14.00",
  name: "Test Corp",
  sector: "Technology",
  exchange: "NASDAQ",
};

function catalystAgg(overrides: Partial<AggregatedSymbol> = {}): AggregatedSymbol {
  return {
    symbol: "TEST",
    signals: [
      { symbol: "TEST", source: "REDDIT", title: "Breakout chatter", upvotes: 80 },
      { symbol: "TEST", source: "SEC_INSIDER", title: "CEO buy", purchaseValue: 250_000 },
    ],
    sourceCount: 2,
    weightedSourceScore: 3,
    subredditCount: 1,
    totalUpvotes: 80,
    totalComments: 10,
    avgVelocity: 3,
    momentum: { risingCount: 1, freshCount: 1, recentCount: 0, commentDerivedCount: 0, staleCount: 0 },
    medianSignalAgeHrs: 2,
    ...overrides,
  };
}

function socialOnlyAgg(): AggregatedSymbol {
  return {
    symbol: "TEST",
    signals: [{ symbol: "TEST", source: "REDDIT", title: "Hype", upvotes: 200 }],
    sourceCount: 1,
    weightedSourceScore: 1,
    subredditCount: 1,
    totalUpvotes: 200,
    totalComments: 50,
    avgVelocity: 8,
    momentum: { risingCount: 1, freshCount: 1, recentCount: 0, commentDerivedCount: 0, staleCount: 0 },
    medianSignalAgeHrs: 1,
  };
}

const proseOnly = {
  catalyst: "Insider purchase detected.",
  risks: "Thin float.",
  report: "Analysis paragraph.",
};

const minimalTradeSetup = {
  entryLo: 9.5,
  entryHi: 10.2,
  confidence: "Medium",
};

const anchoredBracket = {
  targetPct: 0.06,
  stopPct: -0.04,
  source: "anchor" as const,
  sampleSize: 50,
};

function mockSingleShotReport(body: Record<string, unknown>) {
  mockChatJSON.mockResolvedValue({
    content: JSON.stringify(body),
    provider: "openai",
  });
}

function mockReACTReport(body: Record<string, unknown>) {
  mockChatJSON.mockResolvedValue({
    content: JSON.stringify({ action: "final_answer", ...body }),
    provider: "openai",
  });
}

/** Integration tests for finalizeReport orchestration — rule logic lives in recommendation.test.ts */
describe("report pipeline — finalizeReport orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTradeBracket.mockResolvedValue(anchoredBracket);
  });

  it("overrides LLM recommendation and strips tradeSetup when computed rec is Watch", async () => {
    mockReACTReport({
      ...proseOnly,
      recommendation: "Strong Buy",
      tradeSetup: minimalTradeSetup,
    });

    const result = await generateTickerReportReACT(
      "TEST",
      socialOnlyAgg(),
      fundamentals,
      40,
      "scan1",
      undefined,
      undefined,
      undefined,
      TickerStage.EARLY,
    );

    expect(result.recommendation).toBe("Watch");
    expect(result.tradeSetup).toBeUndefined();
  });

  it("accepts minimal LLM tradeSetup draft and applies data-anchored bracket", async () => {
    mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

    const result = await generateTickerReport(
      "TEST",
      catalystAgg(),
      fundamentals,
      65,
      undefined,
      undefined,
      undefined,
      TickerStage.FORMING,
    );

    expect(result.recommendation).toBe("Strong Buy");
    expect(result.tradeSetup).toBeDefined();
    expect(result.tradeSetup!.entryLo).toBe(9.5);
    expect(result.tradeSetup!.entryHi).toBe(10.2);
    expect(result.tradeSetup!.target1).toBe(10.44);
    expect(result.tradeSetup!.stopLoss).toBe(9.46);
    expect(result.tradeSetup!.timeframe).toBe("up to 7 days");
    expect(result.tradeSetup!.riskReward).toBe("1:1.5");
    expect(mockResolveTradeBracket).toHaveBeenCalledWith(TickerStage.FORMING);
  });

  it("drops invalid tradeSetup before recommendation gating", async () => {
    mockSingleShotReport({ ...proseOnly, tradeSetup: { entryLo: "bad" } });

    const result = await generateTickerReport(
      "TEST",
      catalystAgg(),
      fundamentals,
      65,
      undefined,
      undefined,
      undefined,
      TickerStage.FORMING,
    );

    expect(result.recommendation).toBe("Strong Buy");
    expect(result.tradeSetup).toBeUndefined();
  });

  it("uses buildRecommendationInput catalyst detection end-to-end", async () => {
    mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

    const volumeSpikeAgg = catalystAgg({
      signals: [
        { symbol: "TEST", source: "REDDIT", title: "Chatter" },
        { symbol: "TEST", source: "VOLUME_SPIKE", title: "2x avg volume" },
      ],
    });

    const result = await generateTickerReport(
      "TEST",
      volumeSpikeAgg,
      fundamentals,
      65,
      undefined,
      undefined,
      undefined,
      TickerStage.FORMING,
    );

    expect(result.recommendation).toBe("Buy");
    expect(result.recommendation).not.toBe("Strong Buy");
  });
});
