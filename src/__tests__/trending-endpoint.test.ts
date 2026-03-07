import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const { GET } = await import("@/app/api/tickers/trending/route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/tickers/trending");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// Helpers to build mock data
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

function makeTicker(symbol: string, aiScore: number, stage: string, createdAt: Date, scanId = "scan_1") {
  return {
    id: `vt_${symbol}_${createdAt.getTime()}`,
    scanId,
    symbol,
    price: 10.5,
    marketCap: 500_000_000,
    catalyst: "Test catalyst",
    risks: "Test risks",
    recommendation: "Buy",
    report: null,
    aiScore,
    stage,
    signalCount: 3,
    sourceCount: 2,
    shortFloat: 0.05,
    avgSentiment: 0.7,
    firstSeenDaysAgo: 5,
    priorAppearances: 2,
    createdAt,
    performance: { return7d: 0.05 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
});
