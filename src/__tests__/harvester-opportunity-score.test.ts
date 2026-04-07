import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";

// --- Mock dependencies ---
const mockCreateScan = vi.fn();
const mockUpdateScan = vi.fn();
const mockUpdateManyScan = vi.fn();
const mockCreateManySignal = vi.fn();
const mockUpdateManySignal = vi.fn();
const mockCreateManyTicker = vi.fn();
const mockFindManySignal = vi.fn();
const mockFindManyTicker = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      create: (...args: unknown[]) => mockCreateScan(...args),
      update: (...args: unknown[]) => mockUpdateScan(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyScan(...args),
    },
    signal: {
      createMany: (...args: unknown[]) => mockCreateManySignal(...args),
      updateMany: (...args: unknown[]) => mockUpdateManySignal(...args),
      findMany: (...args: unknown[]) => mockFindManySignal(...args),
    },
    validatedTicker: {
      createMany: (...args: unknown[]) => mockCreateManyTicker(...args),
      findMany: (...args: unknown[]) => mockFindManyTicker(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  createDevPrismaClient: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/ai", () => ({
  resetCostTracker: vi.fn(),
  getTotalCost: vi.fn().mockReturnValue(0),
}));

vi.mock("@/lib/harvester/scoring", () => ({
  scoreSymbolBatch: vi.fn().mockResolvedValue([
    { symbol: "TEST", score: 45, sentiment: "bullish", reasoning: "test", rawScore: 45 },
  ]),
  defaultScore: vi.fn().mockReturnValue({ score: 20, sentiment: "neutral", rawScore: 20 }),
}));

vi.mock("@/lib/harvester/pnd-filter", () => ({
  checkPndFlags: vi.fn().mockReturnValue({ flagged: false, flags: [], score: 0 }),
  aiPndAssessment: vi.fn(),
  PND_THRESHOLD: 3,
  INFORMATIONAL_FLAGS: new Set([
    "penny_price", "otc_listing", "twitter_coordinated_pump",
    "coordinated_posts", "single_source",
  ]),
}));

vi.mock("@/lib/harvester/fundamentals", () => ({
  fetchFundamentals: vi.fn().mockResolvedValue(
    new Map([
      ["TEST", {
        price: 3.50,
        marketCap: 80_000_000,
        shortFloat: 0.12,
        fiftyTwoWeekRange: "2.00 - 10.00",
        wk52Lo: 2.0,
        wk52Hi: 10.0,
        exchange: "NasdaqCM",
        sector: "Technology",
        floatShares: 5_000_000,
        name: "Test Corp",
      }],
    ])
  ),
}));

const { processSignals } = await import("@/lib/harvester/index");

beforeEach(() => {
  vi.clearAllMocks();

  mockUpdateManyScan.mockResolvedValue({ count: 0 });
  mockCreateScan.mockResolvedValue({ id: "scan_test" });
  mockFindManySignal.mockResolvedValue([]); // no prior congress signals
  mockFindManyTicker.mockResolvedValue([]); // no prior tickers (novel)

  // Capture the transaction callback and execute it with a mock tx
  mockTransaction.mockImplementation(async (fnOrArray: unknown) => {
    if (typeof fnOrArray === "function") {
      await fnOrArray({
        signal: {
          createMany: mockCreateManySignal,
          updateMany: mockUpdateManySignal,
        },
        validatedTicker: { createMany: mockCreateManyTicker },
        scan: { update: mockUpdateScan },
      });
    }
  });
});

describe("processSignals — opportunityScore integration", () => {
  it("includes opportunityScore as a positive integer in ticker data", async () => {
    const signals: RawSignal[] = [
      {
        symbol: "TEST",
        source: "REDDIT",
        title: "TEST breakout imminent",
        url: "https://reddit.com/r/stocks/test",
        upvotes: 50,
        commentCount: 10,
        subreddit: "stocks",
        postAge: 1.5,
        sortType: "rising",
      },
      {
        symbol: "TEST",
        source: "STOCKTWITS",
        title: "TEST looking good",
        url: "https://stocktwits.com/test",
      },
    ];

    await processSignals(signals);

    expect(mockCreateManyTicker).toHaveBeenCalledTimes(1);
    const tickerData = mockCreateManyTicker.mock.calls[0][0].data;

    expect(tickerData).toHaveLength(1);
    const ticker = tickerData[0];
    expect(ticker.symbol).toBe("TEST");
    expect(ticker.opportunityScore).toBeDefined();
    expect(typeof ticker.opportunityScore).toBe("number");
    expect(ticker.opportunityScore).toBeGreaterThan(0);
    expect(ticker.opportunityScore).toBeLessThanOrEqual(100);

    // With novel micro-cap, high velocity, near 52wk low, fresh signals → should be high
    expect(ticker.opportunityScore).toBeGreaterThanOrEqual(50);
  });

  it("opportunityScore differs from aiScore", async () => {
    const signals: RawSignal[] = [
      { symbol: "TEST", source: "REDDIT", title: "TEST", subreddit: "stocks", postAge: 1, sortType: "rising" },
      { symbol: "TEST", source: "STOCKTWITS", title: "TEST" },
    ];

    await processSignals(signals);

    const tickerData = mockCreateManyTicker.mock.calls[0][0].data;
    const ticker = tickerData[0];

    // aiScore is 45 (from mock), opportunityScore should be different
    expect(ticker.aiScore).toBe(45);
    expect(ticker.opportunityScore).not.toBe(ticker.aiScore);
  });
});
