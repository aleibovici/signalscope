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

const mockGetTradeBracket = vi.fn();
vi.mock("@/lib/anchors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anchors")>("@/lib/anchors");
  return {
    ...actual,
    getTradeBracket: (...args: unknown[]) => mockGetTradeBracket(...args),
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

/** Catalyst + social corroboration (SEC_INSIDER + REDDIT). */
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

/** Social-only, single source. */
function socialOnlyAgg(overrides: Partial<AggregatedSymbol> = {}): AggregatedSymbol {
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
    ...overrides,
  };
}

const proseOnly = {
  catalyst: "Insider purchase detected.",
  risks: "Thin float.",
  report: "Analysis paragraph.",
};

/** New LLM contract: entry range + confidence only. */
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

describe("report pipeline — recommendation v2 integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTradeBracket.mockResolvedValue(anchoredBracket);
  });

  describe("generateTickerReport (single-shot)", () => {
    it("assigns Strong Buy for FORMING + catalyst + multi-source + score>=60", async () => {
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
    });

    it("assigns Buy (not Strong Buy) for EARLY + catalyst + multi-source", async () => {
      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const result = await generateTickerReport(
        "TEST",
        catalystAgg(),
        fundamentals,
        65,
        undefined,
        undefined,
        undefined,
        TickerStage.EARLY,
      );

      expect(result.recommendation).toBe("Buy");
    });

    it("assigns Watch for high-score EARLY social-only (no catalyst path)", async () => {
      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const result = await generateTickerReport(
        "TEST",
        socialOnlyAgg(),
        fundamentals,
        85,
        undefined,
        undefined,
        undefined,
        TickerStage.EARLY,
      );

      expect(result.recommendation).toBe("Watch");
      expect(result.tradeSetup).toBeUndefined();
    });

    it("assigns Buy for CONFIRMED when signals are fresh, Watch when stale", async () => {
      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const fresh = await generateTickerReport(
        "TEST",
        catalystAgg({ medianSignalAgeHrs: 3 }),
        fundamentals,
        65,
        undefined,
        undefined,
        undefined,
        TickerStage.CONFIRMED,
      );
      expect(fresh.recommendation).toBe("Buy");

      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const stale = await generateTickerReport(
        "TEST",
        catalystAgg({ medianSignalAgeHrs: 12 }),
        fundamentals,
        65,
        undefined,
        undefined,
        undefined,
        TickerStage.CONFIRMED,
      );
      expect(stale.recommendation).toBe("Watch");
      expect(stale.tradeSetup).toBeUndefined();
    });

    it("accepts minimal LLM tradeSetup and applies data-anchored bracket on Buy", async () => {
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

      expect(result.tradeSetup).toBeDefined();
      // entry midpoint = (9.5 + 10.2) / 2 = 9.85
      expect(result.tradeSetup!.entryLo).toBe(9.5);
      expect(result.tradeSetup!.entryHi).toBe(10.2);
      expect(result.tradeSetup!.target1).toBe(10.44); // 9.85 * 1.06
      expect(result.tradeSetup!.stopLoss).toBe(9.46); // 9.85 * 0.96
      expect(result.tradeSetup!.timeframe).toBe("up to 7 days");
      expect(result.tradeSetup!.riskReward).toBe("1:1.5");
      expect(mockGetTradeBracket).toHaveBeenCalledWith(TickerStage.FORMING);
    });

    it("strips tradeSetup when computed recommendation is Watch even if LLM emitted one", async () => {
      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const result = await generateTickerReport(
        "TEST",
        socialOnlyAgg(),
        fundamentals,
        40,
        undefined,
        undefined,
        undefined,
        TickerStage.EARLY,
      );

      expect(result.recommendation).toBe("Watch");
      expect(result.tradeSetup).toBeUndefined();
    });

    it("detects catalyst from OPTIONS_FLOW and CONGRESS signal sources", async () => {
      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const optionsAgg = catalystAgg({
        signals: [
          { symbol: "TEST", source: "REDDIT", title: "Chatter" },
          { symbol: "TEST", source: "OPTIONS_FLOW", title: "Unusual calls", optionType: "call" },
        ],
      });

      const optionsResult = await generateTickerReport(
        "TEST",
        optionsAgg,
        fundamentals,
        62,
        undefined,
        undefined,
        undefined,
        TickerStage.FORMING,
      );
      expect(optionsResult.recommendation).toBe("Strong Buy");

      mockSingleShotReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const congressAgg = catalystAgg({
        signals: [
          { symbol: "TEST", source: "STOCKTWITS", title: "Buzz" },
          { symbol: "TEST", source: "CONGRESS", title: "Senator purchase" },
        ],
      });

      const congressResult = await generateTickerReport(
        "TEST",
        congressAgg,
        fundamentals,
        62,
        undefined,
        undefined,
        undefined,
        TickerStage.FORMING,
      );
      expect(congressResult.recommendation).toBe("Strong Buy");
    });
  });

  describe("generateTickerReportReACT", () => {
    it("overrides any LLM recommendation with the deterministic v2 rule", async () => {
      mockReACTReport({
        ...proseOnly,
        recommendation: "Strong Buy", // LLM must not win
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

    it("preserves minimal tradeSetup through ReACT and anchors bracket for Strong Buy", async () => {
      mockReACTReport({ ...proseOnly, tradeSetup: minimalTradeSetup });

      const result = await generateTickerReportReACT(
        "TEST",
        catalystAgg(),
        fundamentals,
        65,
        "scan1",
        undefined,
        undefined,
        undefined,
        TickerStage.FORMING,
      );

      expect(result.recommendation).toBe("Strong Buy");
      expect(result.tradeSetup!.target1).toBeGreaterThan(0);
      expect(result.tradeSetup!.stopLoss).toBeGreaterThan(0);
    });
  });
});
