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
  x402RouteConfigs: { related: {} },
  hasAuthCredentials: vi.fn().mockReturnValue(true),
  withX402: vi.fn(),
}));

const { GET, relatedCache } = await import("@/app/api/tickers/[symbol]/related/route");

function makeRequest(symbol: string, params: Record<string, string> = {}): [NextRequest, { params: Promise<{ symbol: string }> }] {
  const url = new URL(`http://localhost:3000/api/tickers/${symbol}/related`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return [new NextRequest(url), { params: Promise.resolve({ symbol }) }];
}

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
    opportunityScore: 50,
    stage,
    signalCount: 3,
    sourceCount: 2,
    createdAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  relatedCache.clear();
  mockQueryRaw.mockResolvedValue([]);
  mockFindManyTicker.mockResolvedValue([]);
  mockFindManySignal.mockResolvedValue([]);
});

describe("GET /api/tickers/[symbol]/related", () => {
  it("returns empty result when no co-occurring symbols", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await GET(...makeRequest("AAPL"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.relatedTickers).toEqual([]);
    expect(body.targetSymbol).toBe("AAPL");
    expect(body.targetScanCount).toBe(0);
    expect(body.total).toBe(0);
  });

  it("returns related tickers with correct shape", async () => {
    // 1st call: getCoOccurringSymbols, 2nd call: appearance counts
    mockQueryRaw
      .mockResolvedValueOnce([{ symbol: "TSLA", coCount: 3, targetTotal: 5 }])
      .mockResolvedValueOnce([{ symbol: "TSLA", cnt: 4 }]);

    mockFindManyTicker.mockResolvedValue([
      makeTicker("TSLA", 70, "CONFIRMED", daysAgo(1)),
    ]);
    mockFindManySignal.mockResolvedValue([
      { symbol: "TSLA", source: "REDDIT" },
      { symbol: "TSLA", source: "TWITTER" },
    ]);

    const res = await GET(...makeRequest("AAPL"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.relatedTickers).toHaveLength(1);

    const related = body.relatedTickers[0];
    expect(related.symbol).toBe("TSLA");
    expect(related.coOccurrenceCount).toBe(3);
    expect(related.correlationScore).toBeGreaterThan(0);
    expect(related.correlationScore).toBeLessThanOrEqual(1);
    expect(related.latestAiScore).toBe(70);
    expect(related.latestStage).toBe("CONFIRMED");
    expect(related.sources).toEqual(expect.arrayContaining(["REDDIT", "TWITTER"]));
    expect(body.targetSymbol).toBe("AAPL");
    expect(body.targetScanCount).toBe(5);
    expect(body.total).toBe(1);
  });

  it("computes Jaccard correlation correctly", async () => {
    // AAPL in 10 scans, TSLA in 8 scans, 4 shared
    mockQueryRaw
      .mockResolvedValueOnce([{ symbol: "TSLA", coCount: 4, targetTotal: 10 }])
      .mockResolvedValueOnce([{ symbol: "TSLA", cnt: 8 }]);

    mockFindManyTicker.mockResolvedValue([
      makeTicker("TSLA", 65, "FORMING", daysAgo(1)),
    ]);
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(...makeRequest("AAPL"));
    const body = await res.json();

    // Jaccard = 4 / (10 + 8 - 4) = 4/14 ≈ 0.29
    expect(body.relatedTickers[0].correlationScore).toBeCloseTo(0.29, 1);
  });

  it("validates parameters", async () => {
    const res = await GET(...makeRequest("AAPL", { days: "0" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid parameters");
  });

  it("validates stage enum", async () => {
    const res = await GET(...makeRequest("AAPL", { stage: "INVALID" }));
    expect(res.status).toBe(400);
  });

  it("uppercases symbol", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await GET(...makeRequest("aapl"));
    const body = await res.json();

    expect(body.targetSymbol).toBe("AAPL");
  });

  it("paginates results", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { symbol: "TSLA", coCount: 5, targetTotal: 10 },
        { symbol: "MSFT", coCount: 3, targetTotal: 10 },
      ])
      .mockResolvedValueOnce([
        { symbol: "TSLA", cnt: 8 },
        { symbol: "MSFT", cnt: 6 },
      ]);

    mockFindManyTicker.mockResolvedValue([
      makeTicker("TSLA", 70, "CONFIRMED", daysAgo(1)),
      makeTicker("MSFT", 65, "FORMING", daysAgo(1)),
    ]);
    mockFindManySignal.mockResolvedValue([]);

    const res = await GET(...makeRequest("AAPL", { page: "1", limit: "1" }));
    const body = await res.json();

    expect(body.relatedTickers).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.relatedTickers[0].symbol).toBe("TSLA"); // Higher co-occurrence
  });

  it("returns 401 when not authenticated", async () => {
    const { getCurrentUserId } = await import("@/lib/auth");
    (getCurrentUserId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Not authenticated"));

    const res = await GET(...makeRequest("AAPL"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });
});
