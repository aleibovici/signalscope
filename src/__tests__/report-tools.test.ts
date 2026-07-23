import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockFindManySignal = vi.fn();
const mockFindManyTicker = vi.fn();
const mockFindManyPerf = vi.fn();
const mockFindManySnapshot = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signal: { findMany: (...args: unknown[]) => mockFindManySignal(...args) },
    validatedTicker: { findMany: (...args: unknown[]) => mockFindManyTicker(...args) },
    tickerPerformance: { findMany: (...args: unknown[]) => mockFindManyPerf(...args) },
    priceSnapshot: { findMany: (...args: unknown[]) => mockFindManySnapshot(...args) },
  },
}));

// Mock fundamentals
const mockFetchCurrentPrice = vi.fn();
vi.mock("@/lib/harvester/fundamentals", () => ({
  fetchCurrentPrice: (...args: unknown[]) => mockFetchCurrentPrice(...args),
}));

const { TOOL_REGISTRY, TOOL_DEFINITIONS } = await import("@/lib/harvester/report-tools");

describe("TOOL_DEFINITIONS", () => {
  it("defines 6 tools", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(6);
  });

  it("every tool has name, description, and parameters", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
    }
  });

  it("registry has executor for every defined tool", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(TOOL_REGISTRY[tool.name]).toBeTypeOf("function");
    }
  });
});

describe("get_all_signals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries signals by symbol and scanId, returns capped at 20", async () => {
    const signals = Array.from({ length: 25 }, (_, i) => ({
      source: "REDDIT",
      title: `Post ${i}`,
      upvotes: i * 10,
      velocityScore: i,
    }));
    mockFindManySignal.mockResolvedValue(signals.slice(0, 20));

    const result = await TOOL_REGISTRY.get_all_signals({ symbol: "AAPL", scanId: "scan1" });
    expect(mockFindManySignal).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { symbol: "AAPL", scanId: "scan1" },
        orderBy: { velocityScore: "desc" },
        take: 20,
      })
    );
    expect((result as { count: number }).count).toBe(20);
  });

  it("returns empty when no signals", async () => {
    mockFindManySignal.mockResolvedValue([]);
    const result = await TOOL_REGISTRY.get_all_signals({ symbol: "XYZ", scanId: "scan2" });
    expect((result as { count: number }).count).toBe(0);
  });
});

describe("get_current_price", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns price from Yahoo Finance", async () => {
    mockFetchCurrentPrice.mockResolvedValue(150.5);
    const result = (await TOOL_REGISTRY.get_current_price({ symbol: "AAPL" })) as { symbol: string; price: number };
    expect(result.symbol).toBe("AAPL");
    expect(result.price).toBe(150.5);
    expect(result).toHaveProperty("fetchedAt");
  });

  it("returns null price on failure", async () => {
    mockFetchCurrentPrice.mockResolvedValue(null);
    const result = (await TOOL_REGISTRY.get_current_price({ symbol: "BAD" })) as { price: null };
    expect(result.price).toBeNull();
  });
});

describe("get_performance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns performance records", async () => {
    mockFindManyPerf.mockResolvedValue([
      { detectionPrice: 10, return1d: 0.05, return3d: 0.1, return7d: 0.15, return30d: null, createdAt: new Date() },
    ]);
    const result = (await TOOL_REGISTRY.get_performance({ symbol: "TSLA" })) as { records: unknown[] };
    expect(result.records).toHaveLength(1);
  });

  it("returns empty when no performance data", async () => {
    mockFindManyPerf.mockResolvedValue([]);
    const result = (await TOOL_REGISTRY.get_performance({ symbol: "NEW" })) as { records: unknown[] };
    expect(result.records).toHaveLength(0);
  });
});

describe("get_history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns historical appearances", async () => {
    mockFindManyTicker.mockResolvedValue([
      { aiScore: 75, stage: "FORMING", signalCount: 5, createdAt: new Date() },
      { aiScore: 60, stage: "EARLY", signalCount: 3, createdAt: new Date() },
    ]);
    const result = (await TOOL_REGISTRY.get_history({ symbol: "AAPL" })) as { appearances: unknown[] };
    expect(result.appearances).toHaveLength(2);
  });
});

describe("get_peer_context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries peers by sector and market cap range", async () => {
    mockFindManyTicker.mockResolvedValue([
      { symbol: "PEER1", aiScore: 80, stage: "EARLY" },
    ]);
    const result = (await TOOL_REGISTRY.get_peer_context({
      sector: "Technology",
      marketCapRange: "small",
    })) as { peers: unknown[] };
    expect(result.peers).toHaveLength(1);
    expect(mockFindManyTicker).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sector: "Technology",
          marketCap: { gte: 300_000_000, lte: 2_000_000_000 },
        }),
        take: 8,
      })
    );
  });

  it("caps peers at 8", async () => {
    mockFindManyTicker.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ symbol: `P${i}` }))
    );
    const result = (await TOOL_REGISTRY.get_peer_context({
      sector: "Healthcare",
      marketCapRange: "micro",
    })) as { peers: unknown[] };
    expect(result.peers).toHaveLength(8);
  });
});

describe("get_price_snapshots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns snapshots without sampling when <=30", async () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({
      price: 100 + i,
      createdAt: new Date(Date.now() - (10 - i) * 86400000),
    }));
    mockFindManySnapshot.mockResolvedValue(snapshots);
    const result = (await TOOL_REGISTRY.get_price_snapshots({ symbol: "AAPL" })) as { snapshots: unknown[] };
    expect(result.snapshots).toHaveLength(10);
  });

  it("samples down to 30 when more snapshots exist", async () => {
    const snapshots = Array.from({ length: 60 }, (_, i) => ({
      price: 100 + i,
      createdAt: new Date(Date.now() - (60 - i) * 43200000),
    }));
    mockFindManySnapshot.mockResolvedValue(snapshots);
    const result = (await TOOL_REGISTRY.get_price_snapshots({ symbol: "AAPL" })) as { snapshots: { price: number }[] };
    expect(result.snapshots).toHaveLength(30);
    // First snapshot should be the earliest, last should be the most recent
    expect(result.snapshots[0].price).toBe(100);
    expect(result.snapshots[29].price).toBe(159);
  });
});
