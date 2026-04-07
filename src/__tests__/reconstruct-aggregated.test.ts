import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma — reconstructAggregatedSymbol fetches signals from DB
const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signal: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { reconstructAggregatedSymbol } = await import("@/lib/reconstruct-aggregated");

// Minimal ticker shape for the tests — only fields relevant to novelty logic
function makeTicker(overrides: {
  firstSeenDaysAgo?: number | null;
  priorAppearances?: number;
} = {}) {
  return {
    id: "tick_1",
    symbol: "AAPL",
    scanId: "scan_1",
    sourceCount: 2,
    weightedSourceScore: 5,
    subredditCount: 1,
    totalUpvotes: 100,
    totalComments: 20,
    avgVelocity: 1.5,
    risingCount: 1,
    freshCount: 1,
    recentCount: 2,
    commentDerivedCount: 0,
    staleCount: 0,
    price: 150,
    marketCap: 2_000_000_000,
    shortFloat: 0.02,
    fiftyTwoWkRange: "100-200",
    wk52Lo: 100,
    wk52Hi: 200,
    name: "Apple Inc.",
    sector: "Technology",
    exchange: "NASDAQ",
    firstSeenDaysAgo: null,
    priorAppearances: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

// ============================================================
// isNovel computation — bug fix: a8735c1
// ============================================================
describe("reconstructAggregatedSymbol — novelty.isNovel", () => {
  it("is true for a truly novel ticker (firstSeenDaysAgo=null, priorAppearances=0)", async () => {
    const { novelty } = await reconstructAggregatedSymbol(
      makeTicker({ firstSeenDaysAgo: null, priorAppearances: 0 })
    );
    expect(novelty.isNovel).toBe(true);
    expect(novelty.priorAppearances).toBe(0);
    expect(novelty.daysSinceFirstSeen).toBeNull();
  });

  it("is false when firstSeenDaysAgo is 0 (first day but not novel)", async () => {
    const { novelty } = await reconstructAggregatedSymbol(
      makeTicker({ firstSeenDaysAgo: 0, priorAppearances: 0 })
    );
    expect(novelty.isNovel).toBe(false);
    expect(novelty.daysSinceFirstSeen).toBe(0);
  });

  it("is false when ticker has prior appearances even if firstSeenDaysAgo is null (regression guard)", async () => {
    // Before fix: firstSeenDaysAgo === null alone was enough for isNovel=true,
    // which gave priorAppearances>0 tickers a false "novel" label.
    const { novelty } = await reconstructAggregatedSymbol(
      makeTicker({ firstSeenDaysAgo: null, priorAppearances: 1 })
    );
    expect(novelty.isNovel).toBe(false);
    expect(novelty.priorAppearances).toBe(1);
  });

  it("is false when ticker has appeared multiple times before", async () => {
    const { novelty } = await reconstructAggregatedSymbol(
      makeTicker({ firstSeenDaysAgo: 5, priorAppearances: 3 })
    );
    expect(novelty.isNovel).toBe(false);
    expect(novelty.daysSinceFirstSeen).toBe(5);
    expect(novelty.priorAppearances).toBe(3);
  });
});

// ============================================================
// novelty context is always defined (never undefined)
// ============================================================
describe("reconstructAggregatedSymbol — novelty always defined", () => {
  it("returns a defined novelty context for all combinations", async () => {
    const cases = [
      { firstSeenDaysAgo: null, priorAppearances: 0 },
      { firstSeenDaysAgo: null, priorAppearances: 2 },
      { firstSeenDaysAgo: 0,    priorAppearances: 0 },
      { firstSeenDaysAgo: 7,    priorAppearances: 4 },
    ];

    for (const c of cases) {
      const { novelty } = await reconstructAggregatedSymbol(makeTicker(c));
      expect(novelty).toBeDefined();
      expect(typeof novelty.isNovel).toBe("boolean");
      expect(typeof novelty.priorAppearances).toBe("number");
    }
  });
});

// ============================================================
// Fundamentals: null price → null fundamentals
// ============================================================
describe("reconstructAggregatedSymbol — fundamentals", () => {
  it("returns null fundamentals when price is null", async () => {
    const { fundamentals } = await reconstructAggregatedSymbol(
      makeTicker({ firstSeenDaysAgo: null, priorAppearances: 0 })
    );
    // makeTicker sets price: 150 by default — override explicitly
    const { fundamentals: noFundamentals } = await reconstructAggregatedSymbol({
      ...makeTicker(),
      price: null,
    });
    expect(noFundamentals).toBeNull();
    // With price present, fundamentals is not null
    expect(fundamentals).not.toBeNull();
    expect(fundamentals?.price).toBe(150);
  });
});

// ============================================================
// netPremium / callPremiumRatio passthrough — bug fix: 2453e7b
// ============================================================
describe("reconstructAggregatedSymbol — netPremium passthrough", () => {
  it("exposes netPremium and callPremiumRatio from the ticker record", async () => {
    const { agg: aggregated } = await reconstructAggregatedSymbol({
      ...makeTicker(),
      netPremium: 750_000,
      callPremiumRatio: 0.68,
    });
    expect(aggregated.netPremium).toBe(750_000);
    expect(aggregated.callPremiumRatio).toBe(0.68);
  });

  it("returns undefined for both when ticker has no options data", async () => {
    const { agg: aggregated } = await reconstructAggregatedSymbol({
      ...makeTicker(),
      netPremium: null,
      callPremiumRatio: null,
    });
    expect(aggregated.netPremium).toBeUndefined();
    expect(aggregated.callPremiumRatio).toBeUndefined();
  });

  it("handles negative netPremium (put-dominated flow)", async () => {
    const { agg: aggregated } = await reconstructAggregatedSymbol({
      ...makeTicker(),
      netPremium: -500_000,
      callPremiumRatio: 0.2,
    });
    expect(aggregated.netPremium).toBe(-500_000);
    expect(aggregated.callPremiumRatio).toBe(0.2);
  });
});
