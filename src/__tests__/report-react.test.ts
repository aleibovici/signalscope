import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatJSONRequest, ChatJSONResponse } from "@/lib/ai/types";
import type { AggregatedSymbol, FundamentalData, NoveltyContext } from "@/lib/harvester/types";

// Mock chatJSON (used by both single-shot generateTickerReport and chatReACT)
const mockChatJSON = vi.fn<(req: ChatJSONRequest) => Promise<ChatJSONResponse>>();
vi.mock("@/lib/ai", () => ({
  chatJSON: (req: ChatJSONRequest) => mockChatJSON(req),
}));

// Mock tool registry for ReACT
vi.mock("@/lib/harvester/report-tools", () => ({
  TOOL_REGISTRY: {
    get_all_signals: vi.fn().mockResolvedValue({ count: 3, signals: [
      { source: "REDDIT", title: "AAPL to the moon", upvotes: 150 },
      { source: "REDDIT", title: "AAPL insider buying", upvotes: 200 },
      { source: "SEC_INSIDER", title: "CEO purchase", purchaseValue: 500000 },
    ]}),
    get_current_price: vi.fn().mockResolvedValue({ symbol: "AAPL", price: 175.50 }),
    get_performance: vi.fn().mockResolvedValue({ symbol: "AAPL", records: [
      { detectionPrice: 170, return7d: 0.03 },
    ]}),
    get_history: vi.fn().mockResolvedValue({ symbol: "AAPL", appearances: [] }),
    get_peer_context: vi.fn().mockResolvedValue({ peers: [] }),
    get_price_snapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
  },
  TOOL_DEFINITIONS: [
    { name: "get_all_signals", description: "Get signals", parameters: {} },
    { name: "get_performance", description: "Get perf", parameters: {} },
  ],
}));

// Must import after mocks
const { generateTickerReportReACT } = await import("@/lib/harvester/report");

const sampleAgg: AggregatedSymbol = {
  symbol: "AAPL",
  signals: [
    { symbol: "AAPL", source: "REDDIT", title: "AAPL breakout", upvotes: 100, subreddit: "wallstreetbets" },
    { symbol: "AAPL", source: "SEC_INSIDER", title: "CEO bought", insiderTitle: "CEO", purchaseValue: 500000 },
  ],
  sourceCount: 2,
  weightedSourceScore: 3.5,
  subredditCount: 1,
  totalUpvotes: 100,
  totalComments: 25,
  avgVelocity: 4.2,
  momentum: { risingCount: 1, freshCount: 1, recentCount: 0, commentDerivedCount: 0, staleCount: 0 },
  medianSignalAgeHrs: 2,
};

const sampleFundamentals: FundamentalData = {
  price: 175,
  marketCap: 2_800_000_000_000,
  shortFloat: 0.01,
  fiftyTwoWeekRange: "140.00 - 200.00",
  name: "Apple Inc.",
  sector: "Technology",
  exchange: "NASDAQ",
};

const sampleNovelty: NoveltyContext = {
  firstSeenAt: null,
  daysSinceFirstSeen: null,
  priorAppearances: 0,
  isNovel: true,
};

const reportResponse = {
  action: "final_answer",
  catalyst: "CEO purchased $500K of stock — insider buying signals confidence.",
  risks: "Large-cap, limited upside from current level.",
  recommendation: "Buy",
  report: "Apple shows insider buying confirmation alongside social momentum. The CEO purchase of $500K is notable. Multiple sources corroborate interest. Technical setup looks favorable near 52-week range midpoint.",
  tradeSetup: {
    entryLo: 173,
    entryHi: 177,
    stopLoss: 165,
    target1: 195,
    target2: 210,
    timeframe: "1-3 weeks",
    riskReward: "1:2.5",
    confidence: "High",
  },
};

describe("generateTickerReportReACT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs ReACT loop with tool calls and produces report", async () => {
    // Step 1: AI requests get_all_signals
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify({
        action: "tool_call",
        tool: "get_all_signals",
        parameters: { symbol: "AAPL", scanId: "scan1" },
        reasoning: "Need to see all signals",
      }),
      provider: "openai",
    });

    // Step 2: AI requests get_performance
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify({
        action: "tool_call",
        tool: "get_performance",
        parameters: { symbol: "AAPL" },
        reasoning: "Check historical performance",
      }),
      provider: "openai",
    });

    // Step 3: AI produces final answer
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify(reportResponse),
      provider: "openai",
    });

    const result = await generateTickerReportReACT(
      "AAPL", sampleAgg, sampleFundamentals, 75,
      "scan1", "insider_buy", sampleNovelty
    );

    expect(result.catalyst).toContain("CEO purchased");
    expect(result.recommendation).toBe("Buy");
    expect(result.tradeSetup).toBeDefined();
    expect(result.tradeSetup!.entryLo).toBe(173);
    expect(mockChatJSON).toHaveBeenCalledTimes(3);
  });

  it("output matches TickerReport shape", async () => {
    mockChatJSON.mockResolvedValue({
      content: JSON.stringify(reportResponse),
      provider: "openai",
    });

    const result = await generateTickerReportReACT(
      "AAPL", sampleAgg, sampleFundamentals, 75,
      "scan1", "insider_buy", sampleNovelty
    );

    expect(typeof result.catalyst).toBe("string");
    expect(typeof result.risks).toBe("string");
    expect(typeof result.recommendation).toBe("string");
    expect(typeof result.report).toBe("string");
    if (result.tradeSetup) {
      expect(typeof result.tradeSetup.entryLo).toBe("number");
      expect(typeof result.tradeSetup.confidence).toBe("string");
    }
  });

  it("falls back to single-shot on ReACT failure", async () => {
    // ReACT calls fail
    mockChatJSON
      .mockRejectedValueOnce(new Error("AI provider error"))
      // Single-shot fallback succeeds
      .mockResolvedValueOnce({
        content: JSON.stringify({
          catalyst: "Fallback catalyst",
          risks: "Fallback risks",
          recommendation: "Watch",
          report: "Fallback report.",
        }),
        provider: "openai",
      });

    const result = await generateTickerReportReACT(
      "AAPL", sampleAgg, sampleFundamentals, 75,
      "scan1", "insider_buy", sampleNovelty
    );

    expect(result.catalyst).toBe("Fallback catalyst");
  });

  it("works without optional params", async () => {
    mockChatJSON.mockResolvedValue({
      content: JSON.stringify({
        ...reportResponse,
        tradeSetup: undefined,
        recommendation: "Watch",
      }),
      provider: "openai",
    });

    const result = await generateTickerReportReACT(
      "AAPL", sampleAgg, null, 50, "scan1"
    );

    expect(result.recommendation).toBe("Watch");
  });
});
