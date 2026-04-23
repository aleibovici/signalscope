import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma + IBKR client so tests are pure unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brokerPosition: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    brokerOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const mockPlaceBracketOrder = vi.fn().mockResolvedValue({
  clientOrderId: "test-uuid",
  brokerOrderId: "alpaca-order-9001",
});
const mockBrokerClient = {
  provider: "alpaca",
  placeBracketOrder: mockPlaceBracketOrder,
  listOpenOrders: vi.fn().mockResolvedValue([]),
  getOrder: vi.fn().mockResolvedValue(null),
  cancelOrder: vi.fn().mockResolvedValue(undefined),
  listPositions: vi.fn().mockResolvedValue([]),
  placeMarketSell: vi.fn().mockResolvedValue(undefined),
  getAccount: vi.fn().mockResolvedValue({ equity: 100000, cash: 100000, currency: "USD" }),
};

vi.mock("@/lib/brokers/factory", () => ({
  getBrokerClient: vi.fn(() => mockBrokerClient),
  isConfigured: vi.fn(() => true),
}));

import { executeForTickers } from "@/lib/brokers/executor";
import type { ValidatedTicker } from "@/generated/prisma/client";

function makeTicker(overrides: Partial<ValidatedTicker> = {}): ValidatedTicker {
  return {
    id: "vt-1",
    scanId: "scan-1",
    symbol: "AAPL",
    price: 150,
    marketCap: null,
    shortFloat: null,
    catalyst: "Strong earnings",
    risks: null,
    recommendation: "BUY",
    report: null,
    aiScore: 80,
    opportunityScore: 85,
    stage: "EARLY" as const,
    signalCount: 3,
    sourceCount: 2,
    avgSentiment: 0.7,
    signalType: null,
    fiftyTwoWkRange: null,
    wk52Lo: null,
    wk52Hi: null,
    exchange: "NASDAQ",
    firstSeenDaysAgo: null,
    priorAppearances: 0,
    weightedSourceScore: null,
    avgVelocity: null,
    totalUpvotes: null,
    totalComments: null,
    subredditCount: null,
    risingCount: null,
    freshCount: null,
    recentCount: null,
    commentDerivedCount: null,
    staleCount: null,
    aiReasoning: null,
    sector: null,
    floatShares: null,
    name: "Apple Inc",
    pndFlagged: false,
    pndFlags: [],
    pndScore: 0,
    rawAiScore: null,
    pndAiConfidence: null,
    pndAiReasoning: null,
    medianSignalAgeHrs: null,
    netPremium: null,
    callPremiumRatio: null,
    tradeSetupEntryLo: 148,
    tradeSetupEntryHi: 152,
    tradeSetupStopLoss: 142,
    tradeSetupTarget1: 165,
    tradeSetupTarget2: 180,
    tradeSetupTimeframe: "5-7 days",
    tradeSetupRiskReward: "1:2.0",
    tradeSetupConfidence: "High",
    createdAt: new Date("2026-04-23T09:00:00Z"),
    ...overrides,
  } as ValidatedTicker;
}

describe("executeForTickers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a bracket order for a valid ticker", async () => {
    const tickers = [makeTicker()];
    const results = await executeForTickers(tickers);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("placed");
    expect(results[0].symbol).toBe("AAPL");
    expect(mockPlaceBracketOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "AAPL",
        qty: 6, // floor(1000/152)
        entryLimit: 152,
        stopPrice: 142,
        targetPrice: 165,
      }),
    );
  });

  it("skips ticker with incomplete trade setup (no stop loss)", async () => {
    const tickers = [makeTicker({ tradeSetupStopLoss: null })];
    const results = await executeForTickers(tickers);

    expect(results[0].status).toBe("skipped");
    expect(results[0].reason).toContain("incomplete trade setup");
  });

  it("skips ticker with incomplete trade setup (no entryHi)", async () => {
    const tickers = [makeTicker({ tradeSetupEntryHi: null })];
    const results = await executeForTickers(tickers);
    expect(results[0].status).toBe("skipped");
  });

  it("skips ticker where price is too high for $1000 position", async () => {
    const tickers = [makeTicker({ tradeSetupEntryHi: 1500 })];
    const results = await executeForTickers(tickers);
    expect(results[0].status).toBe("skipped");
    expect(results[0].reason).toContain("too high");
  });

  it("computes correct quantity: floor(1000 / entryHi)", async () => {
    // entryHi = 33, floor(1000/33) = 30
    const tickers = [makeTicker({ tradeSetupEntryHi: 33 })];
    await executeForTickers(tickers);
    expect(mockPlaceBracketOrder).toHaveBeenCalledWith(
      expect.objectContaining({ qty: 30 }),
    );
  });

  it("skips ticker when open position already exists for symbol", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.brokerPosition.findMany).mockResolvedValueOnce([
      { symbol: "AAPL" } as never,
    ]);
    const tickers = [makeTicker()];
    const results = await executeForTickers(tickers);
    expect(results[0].status).toBe("skipped");
    expect(results[0].reason).toContain("open position");
  });

  it("skips ticker where parent order already placed (idempotency)", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.brokerOrder.findMany).mockResolvedValueOnce([
      { validatedTickerId: "vt-1" } as never,
    ]);
    const tickers = [makeTicker()];
    const results = await executeForTickers(tickers);
    expect(results[0].status).toBe("skipped");
    expect(results[0].reason).toContain("already placed");
  });

  it("returns error status when broker call throws", async () => {
    mockPlaceBracketOrder.mockRejectedValueOnce(new Error("Alpaca unavailable"));
    const tickers = [makeTicker()];
    const results = await executeForTickers(tickers);
    expect(results[0].status).toBe("error");
    expect(results[0].reason).toContain("Alpaca unavailable");
  });

  it("deduplicates within batch — skips second ticker with same symbol", async () => {
    const t1 = makeTicker({ id: "vt-1" });
    const t2 = makeTicker({ id: "vt-2", tradeSetupEntryHi: 153 });
    const results = await executeForTickers([t1, t2]);
    expect(results[0].status).toBe("placed");
    expect(results[1].status).toBe("skipped");
    expect(results[1].reason).toContain("open position");
  });
});
