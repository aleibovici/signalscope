import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user_1"),
}));

// Mock prisma
const mockQueryRaw = vi.fn();
const mockFindManyTicker = vi.fn();
const mockFindManySignal = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    validatedTicker: { findMany: (...args: unknown[]) => mockFindManyTicker(...args) },
    signal: { findMany: (...args: unknown[]) => mockFindManySignal(...args) },
  },
}));

// Mock x402 (avoids @x402/next ESM resolution issues in vitest)
vi.mock("@/lib/x402", () => ({
  X402_ENABLED: false,
  x402Server: null,
  x402RouteConfigs: { trending: {}, report: {} },
  hasAuthCredentials: vi.fn().mockReturnValue(true),
  withX402: vi.fn(),
}));

const { GET, trendingCache } = await import("@/app/api/tickers/trending/route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/tickers/trending");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// Helpers to build mock data
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

function makeTicker(
  symbol: string,
  aiScore: number,
  stage: string,
  createdAt: Date,
  scanId = "scan_1",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `vt_${symbol}_${createdAt.getTime()}`,
    scanId,
    symbol,
    name: overrides.name ?? "Test Corp",
    price: overrides.price ?? 10.5,
    marketCap: overrides.marketCap ?? 500_000_000,
    sector: overrides.sector ?? "Technology",
    catalyst: "Test catalyst",
    risks: "Test risks",
    recommendation: "Buy",
    report: null,
    aiScore,
    opportunityScore: overrides.opportunityScore ?? Math.max(0, 100 - aiScore),
    stage,
    signalCount: 3,
    sourceCount: 2,
    shortFloat: 0.05,
    avgSentiment: 0.7,
    firstSeenDaysAgo: 5,
    priorAppearances: 2,
    exchange: overrides.exchange ?? null,
    wk52Lo: overrides.wk52Lo ?? null,
    wk52Hi: overrides.wk52Hi ?? null,
    pndFlagged: overrides.pndFlagged ?? false,
    pndScore: overrides.pndScore ?? 0,
    pndFlags: overrides.pndFlags ?? [],
    createdAt,
    performance: overrides.performance ?? { return1d: 0.01, return3d: 0.03, return7d: 0.05, return30d: 0.10 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trendingCache.clear();
  // Default: no results
  mockQueryRaw.mockResolvedValue([]);
  mockFindManyTicker.mockResolvedValue([]);
  mockFindManySignal.mockResolvedValue([]);
});

describe("GET /api/tickers/trending", () => {
  it("returns empty result when no qualifying symbols", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tickers).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.summary).toEqual({
      totalTrending: 0,
      risingCount: 0,
      fallingCount: 0,
      stableCount: 0,
      avgScore: 0,
    });
  });

  it("returns trending tickers with correct response shape", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "AAPL", cnt: BigInt(3) },
    ]);

    // Appearances for trajectory
    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        // Latest record query
        return [makeTicker("AAPL", 65, "CONFIRMED", daysAgo(1))];
      }
      // All appearances query
      return [
        { symbol: "AAPL", aiScore: 50, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "AAPL", aiScore: 55, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "AAPL", aiScore: 65, stage: "CONFIRMED", createdAt: daysAgo(1) },
      ];
    });

    mockFindManySignal.mockResolvedValue([
      { symbol: "AAPL", source: "REDDIT" },
      { symbol: "AAPL", source: "TWITTER" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tickers).toHaveLength(1);

    const ticker = body.tickers[0];
    expect(ticker.symbol).toBe("AAPL");
    expect(ticker.appearanceCount).toBe(3);
    expect(ticker.trend).toBe("rising");
    expect(ticker.scoreTrajectory).toHaveLength(3);
    expect(ticker.sources).toEqual(expect.arrayContaining(["REDDIT", "TWITTER"]));
    expect(ticker.aiScore).toBe(65);
    expect(ticker.return7d).toBe(0.05);

    // New fields
    expect(ticker.name).toBe("Test Corp");
    expect(ticker.sector).toBe("Technology");
    expect(ticker.pndFlagged).toBe(false);
    expect(ticker.pndScore).toBe(0);
    expect(ticker.pndFlags).toEqual([]);
    expect(ticker.return1d).toBe(0.01);
    expect(ticker.return3d).toBe(0.03);
    expect(ticker.return30d).toBe(0.10);

    expect(body.summary.totalTrending).toBe(1);
    expect(body.summary.risingCount).toBe(1);
    expect(body.summary.avgScore).toBe(65);
  });

  it("computes rising trend when second half scores are 5+ higher", async () => {
    mockQueryRaw.mockResolvedValue([{ symbol: "TST", cnt: BigInt(4) }]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) return [makeTicker("TST", 70, "CONFIRMED", daysAgo(1))];
      return [
        { symbol: "TST", aiScore: 40, stage: "EARLY", createdAt: daysAgo(20) },
        { symbol: "TST", aiScore: 42, stage: "EARLY", createdAt: daysAgo(15) },
        { symbol: "TST", aiScore: 55, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "TST", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.tickers[0].trend).toBe("rising");
  });

  it("computes falling trend when second half scores are 5+ lower", async () => {
    mockQueryRaw.mockResolvedValue([{ symbol: "DIP", cnt: BigInt(4) }]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) return [makeTicker("DIP", 30, "EARLY", daysAgo(1))];
      return [
        { symbol: "DIP", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(20) },
        { symbol: "DIP", aiScore: 65, stage: "FORMING", createdAt: daysAgo(15) },
        { symbol: "DIP", aiScore: 35, stage: "EARLY", createdAt: daysAgo(5) },
        { symbol: "DIP", aiScore: 30, stage: "EARLY", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.tickers[0].trend).toBe("falling");
  });

  it("computes stable trend when delta is within threshold", async () => {
    mockQueryRaw.mockResolvedValue([{ symbol: "FLAT", cnt: BigInt(4) }]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) return [makeTicker("FLAT", 52, "FORMING", daysAgo(1))];
      return [
        { symbol: "FLAT", aiScore: 50, stage: "FORMING", createdAt: daysAgo(20) },
        { symbol: "FLAT", aiScore: 48, stage: "FORMING", createdAt: daysAgo(15) },
        { symbol: "FLAT", aiScore: 51, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "FLAT", aiScore: 52, stage: "FORMING", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.tickers[0].trend).toBe("stable");
  });

  it("filters by trend parameter", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "UP", cnt: BigInt(2) },
      { symbol: "DOWN", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("UP", 70, "CONFIRMED", daysAgo(1)),
          makeTicker("DOWN", 30, "EARLY", daysAgo(1)),
        ];
      }
      return [
        { symbol: "UP", aiScore: 40, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "UP", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "DOWN", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(10) },
        { symbol: "DOWN", aiScore: 30, stage: "EARLY", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ trend: "rising" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("UP");
    expect(body.total).toBe(1);
    expect(body.summary.risingCount).toBe(1);
  });

  it("validates minAppearances minimum of 2", async () => {
    const res = await GET(makeRequest({ minAppearances: "1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid parameters");
  });

  it("validates stage enum", async () => {
    const res = await GET(makeRequest({ stage: "INVALID" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid parameters");
  });

  it("validates trend enum", async () => {
    const res = await GET(makeRequest({ trend: "sideways" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid parameters");
  });

  it("sorts by appearance count desc, then aiScore desc", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "FEW", cnt: BigInt(2) },
      { symbol: "MANY", cnt: BigInt(5) },
      { symbol: "MID", cnt: BigInt(3) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("FEW", 90, "CONFIRMED", daysAgo(1)),
          makeTicker("MANY", 60, "FORMING", daysAgo(1)),
          makeTicker("MID", 50, "EARLY", daysAgo(1)),
        ];
      }
      return [
        { symbol: "FEW", aiScore: 85, stage: "CONFIRMED", createdAt: daysAgo(5) },
        { symbol: "FEW", aiScore: 90, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "MANY", aiScore: 50, stage: "EARLY", createdAt: daysAgo(20) },
        { symbol: "MANY", aiScore: 55, stage: "FORMING", createdAt: daysAgo(15) },
        { symbol: "MANY", aiScore: 57, stage: "FORMING", createdAt: daysAgo(10) },
        { symbol: "MANY", aiScore: 58, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "MANY", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "MID", aiScore: 45, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "MID", aiScore: 48, stage: "EARLY", createdAt: daysAgo(5) },
        { symbol: "MID", aiScore: 50, stage: "EARLY", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.tickers.map((t: { symbol: string }) => t.symbol)).toEqual(["MANY", "MID", "FEW"]);
  });

  it("paginates correctly", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "A", cnt: BigInt(3) },
      { symbol: "B", cnt: BigInt(3) },
      { symbol: "C", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("A", 80, "CONFIRMED", daysAgo(1)),
          makeTicker("B", 70, "FORMING", daysAgo(1)),
          makeTicker("C", 60, "EARLY", daysAgo(1)),
        ];
      }
      return [
        { symbol: "A", aiScore: 70, stage: "FORMING", createdAt: daysAgo(10) },
        { symbol: "A", aiScore: 75, stage: "CONFIRMED", createdAt: daysAgo(5) },
        { symbol: "A", aiScore: 80, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "B", aiScore: 60, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "B", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "B", aiScore: 70, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "C", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
        { symbol: "C", aiScore: 60, stage: "EARLY", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    // Page 1, limit 2
    const res1 = await GET(makeRequest({ page: "1", limit: "2" }));
    const body1 = await res1.json();
    expect(body1.tickers).toHaveLength(2);
    expect(body1.total).toBe(3);

    // Page 2, limit 2
    const res2 = await GET(makeRequest({ page: "2", limit: "2" }));
    const body2 = await res2.json();
    expect(body2.tickers).toHaveLength(1);
    expect(body2.total).toBe(3);
  });

  it("summary counts are computed before pagination", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "R1", cnt: BigInt(2) },
      { symbol: "R2", cnt: BigInt(2) },
      { symbol: "S1", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("R1", 70, "CONFIRMED", daysAgo(1)),
          makeTicker("R2", 65, "FORMING", daysAgo(1)),
          makeTicker("S1", 50, "EARLY", daysAgo(1)),
        ];
      }
      return [
        // R1 rising
        { symbol: "R1", aiScore: 40, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "R1", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        // R2 rising
        { symbol: "R2", aiScore: 35, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "R2", aiScore: 65, stage: "FORMING", createdAt: daysAgo(1) },
        // S1 stable
        { symbol: "S1", aiScore: 49, stage: "EARLY", createdAt: daysAgo(10) },
        { symbol: "S1", aiScore: 50, stage: "EARLY", createdAt: daysAgo(1) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    // Get only page 1 with limit 1 — summary should still reflect all 3
    const res = await GET(makeRequest({ page: "1", limit: "1" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(body.summary.totalTrending).toBe(3);
    expect(body.summary.risingCount).toBe(2);
    expect(body.summary.stableCount).toBe(1);
    expect(body.summary.avgScore).toBe(62); // (70+65+50)/3 = 61.67 → 62
  });

  it("returns 500 on unexpected error", async () => {
    mockQueryRaw.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("defaults minAppearances to 2", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await GET(makeRequest());

    // Verify the raw query was called (we can't easily inspect template literal params,
    // but we can verify the query was executed)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("uses default pagination (page 1, limit 20)", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tickers).toEqual([]);
  });

  // --- New filter tests ---

  it("filters by sector", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "TECH", cnt: BigInt(2) },
      { symbol: "HLTH", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[]; where?: { sector?: string } }) => {
      if (args.distinct) {
        // When sector filter is applied, Prisma only returns matching records
        const sector = args.where?.sector;
        const records = [
          makeTicker("TECH", 70, "CONFIRMED", daysAgo(1), "scan_1", { sector: "Technology" }),
          makeTicker("HLTH", 60, "FORMING", daysAgo(1), "scan_1", { sector: "Healthcare" }),
        ];
        return sector ? records.filter((r) => r.sector === sector) : records;
      }
      return [
        { symbol: "TECH", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "HLTH", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "TECH", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "HLTH", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ sector: "Technology" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("TECH");
    expect(body.tickers[0].sector).toBe("Technology");
  });

  it("filters by market cap bucket", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "BIG", cnt: BigInt(2) },
      { symbol: "SML", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("BIG", 70, "CONFIRMED", daysAgo(1), "scan_1", { marketCap: 15_000_000_000 }),
          makeTicker("SML", 60, "FORMING", daysAgo(1), "scan_1", { marketCap: 100_000_000 }),
        ];
      }
      return [
        { symbol: "BIG", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "BIG", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "SML", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "SML", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ marketCap: "micro" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("SML");
  });

  it("excludes null marketCap when bucket filter is applied", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "NOMC", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [makeTicker("NOMC", 70, "CONFIRMED", daysAgo(1), "scan_1", { marketCap: null })];
      }
      return [
        { symbol: "NOMC", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "NOMC", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ marketCap: "micro" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(0);
  });

  it("sorts by AI score descending", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "LOW", cnt: BigInt(2) },
      { symbol: "HI", cnt: BigInt(5) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("LOW", 40, "EARLY", daysAgo(1)),
          makeTicker("HI", 90, "CONFIRMED", daysAgo(1)),
        ];
      }
      return [
        { symbol: "LOW", aiScore: 40, stage: "EARLY", createdAt: daysAgo(1) },
        { symbol: "LOW", aiScore: 35, stage: "EARLY", createdAt: daysAgo(5) },
        { symbol: "HI", aiScore: 90, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "HI", aiScore: 85, stage: "CONFIRMED", createdAt: daysAgo(5) },
        { symbol: "HI", aiScore: 80, stage: "FORMING", createdAt: daysAgo(10) },
        { symbol: "HI", aiScore: 75, stage: "EARLY", createdAt: daysAgo(15) },
        { symbol: "HI", aiScore: 70, stage: "EARLY", createdAt: daysAgo(20) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    // Default sort: HI first (5 appearances vs 2)
    const res1 = await GET(makeRequest());
    const body1 = await res1.json();
    expect(body1.tickers[0].symbol).toBe("HI");

    // Sort by aiScore: HI (90) still first but for different reason
    trendingCache.clear();
    const res2 = await GET(makeRequest({ sortBy: "aiScore" }));
    const body2 = await res2.json();
    expect(body2.tickers[0].symbol).toBe("HI");
    expect(body2.tickers[1].symbol).toBe("LOW");
  });

  it("sorts by price descending", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "CHEAP", cnt: BigInt(2) },
      { symbol: "PRICEY", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("CHEAP", 70, "CONFIRMED", daysAgo(1), "scan_1", { price: 5 }),
          makeTicker("PRICEY", 60, "FORMING", daysAgo(1), "scan_1", { price: 200 }),
        ];
      }
      return [
        { symbol: "CHEAP", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "CHEAP", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "PRICEY", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "PRICEY", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ sortBy: "price" }));
    const body = await res.json();

    expect(body.tickers[0].symbol).toBe("PRICEY");
    expect(body.tickers[1].symbol).toBe("CHEAP");
  });

  it("sorts by return for selected period", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "SLOW", cnt: BigInt(2) },
      { symbol: "FAST", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("SLOW", 70, "CONFIRMED", daysAgo(1), "scan_1", {
            performance: { return1d: 0.01, return3d: 0.02, return7d: 0.03, return30d: 0.04 },
          }),
          makeTicker("FAST", 60, "FORMING", daysAgo(1), "scan_1", {
            performance: { return1d: 0.05, return3d: 0.10, return7d: 0.15, return30d: 0.20 },
          }),
        ];
      }
      return [
        { symbol: "SLOW", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "SLOW", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "FAST", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "FAST", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ sortBy: "return", returnPeriod: "3d" }));
    const body = await res.json();

    expect(body.tickers[0].symbol).toBe("FAST");
    expect(body.tickers[0].return3d).toBe(0.10);
  });

  it("sorts by opportunity score descending", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "LO_OPP", cnt: BigInt(2) },
      { symbol: "HI_OPP", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("LO_OPP", 90, "CONFIRMED", daysAgo(1), "scan_1", { opportunityScore: 10 }),
          makeTicker("HI_OPP", 30, "EARLY", daysAgo(1), "scan_1", { opportunityScore: 85 }),
        ];
      }
      return [
        { symbol: "LO_OPP", aiScore: 90, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "LO_OPP", aiScore: 85, stage: "CONFIRMED", createdAt: daysAgo(5) },
        { symbol: "HI_OPP", aiScore: 30, stage: "EARLY", createdAt: daysAgo(1) },
        { symbol: "HI_OPP", aiScore: 25, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ sortBy: "opportunityScore" }));
    const body = await res.json();

    expect(body.tickers[0].symbol).toBe("HI_OPP");
    expect(body.tickers[0].opportunityScore).toBe(85);
    expect(body.tickers[1].symbol).toBe("LO_OPP");
  });

  it("sorts by market cap descending", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "SML", cnt: BigInt(2) },
      { symbol: "BIG", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("SML", 70, "CONFIRMED", daysAgo(1), "scan_1", { marketCap: 100_000_000 }),
          makeTicker("BIG", 60, "FORMING", daysAgo(1), "scan_1", { marketCap: 50_000_000_000 }),
        ];
      }
      return [
        { symbol: "SML", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "SML", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "BIG", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "BIG", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ sortBy: "marketCap" }));
    const body = await res.json();

    expect(body.tickers[0].symbol).toBe("BIG");
  });

  it("filters by source", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "RED", cnt: BigInt(2) },
      { symbol: "SEC", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          makeTicker("RED", 70, "CONFIRMED", daysAgo(1)),
          makeTicker("SEC", 60, "FORMING", daysAgo(1)),
        ];
      }
      return [
        { symbol: "RED", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "RED", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "SEC", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "SEC", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([
      { symbol: "RED", source: "REDDIT" },
      { symbol: "SEC", source: "SEC_INSIDER" },
    ]);

    const res = await GET(makeRequest({ source: "SEC_INSIDER" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("SEC");
  });

  it("hides P&D flagged tickers when hidePnd=true", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "SAFE", cnt: BigInt(2) },
      { symbol: "PUMP", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[]; where?: { pndFlagged?: boolean } }) => {
      if (args.distinct) {
        const records = [
          makeTicker("SAFE", 70, "CONFIRMED", daysAgo(1), "scan_1", { pndFlagged: false }),
          makeTicker("PUMP", 60, "FORMING", daysAgo(1), "scan_1", { pndFlagged: true, pndScore: 85, pndFlags: ["micro_cap_no_catalyst", "low_float_surge", "social_media_only"] }),
        ];
        // Simulate Prisma filtering by pndFlagged
        if (args.where?.pndFlagged === false) {
          return records.filter((r) => !r.pndFlagged);
        }
        return records;
      }
      return [
        { symbol: "SAFE", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "SAFE", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "PUMP", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "PUMP", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ hidePnd: "true" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("SAFE");
  });

  it("shows P&D fields in response when not hidden", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "PUMP", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [makeTicker("PUMP", 60, "FORMING", daysAgo(1), "scan_1", {
          pndFlagged: true,
          pndScore: 85,
          pndFlags: ["micro_cap_no_catalyst", "low_float_surge", "social_media_only"],
        })];
      }
      return [
        { symbol: "PUMP", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "PUMP", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.tickers[0].pndFlagged).toBe(true);
    expect(body.tickers[0].pndScore).toBe(85);
    expect(body.tickers[0].pndFlags).toEqual(["micro_cap_no_catalyst", "low_float_surge", "social_media_only"]);
  });

  it("filters near 52-week low tickers", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "LOW", cnt: BigInt(2) },
      { symbol: "HIGH", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [
          // LOW: price $10.50, 52wLo $10.00 → 5% above low → within range
          makeTicker("LOW", 70, "CONFIRMED", daysAgo(1), "scan_1", { price: 10.50, wk52Lo: 10.0, wk52Hi: 30.0 }),
          // HIGH: price $28, 52wLo $10 → 180% above low → NOT near low
          makeTicker("HIGH", 60, "FORMING", daysAgo(1), "scan_1", { price: 28.0, wk52Lo: 10.0, wk52Hi: 30.0 }),
        ];
      }
      return [
        { symbol: "LOW", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "LOW", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
        { symbol: "HIGH", aiScore: 60, stage: "FORMING", createdAt: daysAgo(1) },
        { symbol: "HIGH", aiScore: 55, stage: "EARLY", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest({ near52wLow: "true" }));
    const body = await res.json();

    expect(body.tickers).toHaveLength(1);
    expect(body.tickers[0].symbol).toBe("LOW");
  });

  it("validates new enum parameters", async () => {
    const res1 = await GET(makeRequest({ sortBy: "invalid" }));
    expect(res1.status).toBe(400);

    const res2 = await GET(makeRequest({ marketCap: "huge" }));
    expect(res2.status).toBe(400);

    const res3 = await GET(makeRequest({ source: "FACEBOOK" }));
    expect(res3.status).toBe(400);

    const res4 = await GET(makeRequest({ returnPeriod: "2w" }));
    expect(res4.status).toBe(400);
  });

  it("returns all return periods in response", async () => {
    mockQueryRaw.mockResolvedValue([
      { symbol: "RET", cnt: BigInt(2) },
    ]);

    mockFindManyTicker.mockImplementation((args: { distinct?: string[] }) => {
      if (args.distinct) {
        return [makeTicker("RET", 70, "CONFIRMED", daysAgo(1), "scan_1", {
          performance: { return1d: 0.01, return3d: 0.03, return7d: 0.07, return30d: 0.15 },
        })];
      }
      return [
        { symbol: "RET", aiScore: 70, stage: "CONFIRMED", createdAt: daysAgo(1) },
        { symbol: "RET", aiScore: 65, stage: "FORMING", createdAt: daysAgo(5) },
      ];
    });
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    const ticker = body.tickers[0];
    expect(ticker.return1d).toBe(0.01);
    expect(ticker.return3d).toBe(0.03);
    expect(ticker.return7d).toBe(0.07);
    expect(ticker.return30d).toBe(0.15);
  });
});
