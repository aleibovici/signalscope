import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user_1"),
}));

// Mock prisma
const mockQueryRaw = vi.fn();
const mockFindManyTicker = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    validatedTicker: { findMany: (...args: unknown[]) => mockFindManyTicker(...args) },
  },
}));

// Mock x402 (avoids @x402/next ESM resolution issues in vitest)
vi.mock("@/lib/x402", () => ({
  X402_ENABLED: false,
  x402Server: null,
  x402RouteConfigs: { network: {} },
  hasAuthCredentials: vi.fn().mockReturnValue(true),
  withX402: vi.fn(),
}));

const { GET, networkCache } = await import("@/app/api/tickers/network/route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/tickers/network");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

function makeTicker(
  symbol: string,
  aiScore: number,
  stage: string,
  createdAt: Date,
) {
  return {
    id: `vt_${symbol}`,
    scanId: "scan_1",
    symbol,
    name: "Test Corp",
    price: 10.5,
    marketCap: 500_000_000,
    sector: "Technology",
    catalyst: "Test",
    risks: "Test",
    recommendation: "Buy",
    aiScore,
    stage,
    createdAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  networkCache.clear();
  mockQueryRaw.mockResolvedValue([]);
  mockFindManyTicker.mockResolvedValue([]);
});

describe("GET /api/tickers/network", () => {
  it("returns empty result when no nodes", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes).toEqual([]);
    expect(body.edges).toEqual([]);
    expect(body.centerSymbol).toBeNull();
  });

  it("returns nodes and edges with correct structure", async () => {
    // Call sequence: 1) top symbols, 2) pairwise edges, 3) appearance counts
    mockQueryRaw
      .mockResolvedValueOnce([{ symbol: "AAPL" }, { symbol: "TSLA" }])
      .mockResolvedValueOnce([{ source: "AAPL", target: "TSLA", weight: 3 }])
      .mockResolvedValueOnce([
        { symbol: "AAPL", cnt: 5 },
        { symbol: "TSLA", cnt: 4 },
      ]);

    mockFindManyTicker.mockResolvedValue([
      makeTicker("AAPL", 70, "CONFIRMED", daysAgo(1)),
      makeTicker("TSLA", 65, "FORMING", daysAgo(1)),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes).toHaveLength(2);
    expect(body.edges).toHaveLength(1);

    const node = body.nodes.find((n: { symbol: string }) => n.symbol === "AAPL");
    expect(node).toBeDefined();
    expect(node.aiScore).toBe(70);
    expect(node.stage).toBe("CONFIRMED");
    expect(node.appearances).toBe(5);

    const edge = body.edges[0];
    expect(edge.source).toBe("AAPL");
    expect(edge.target).toBe("TSLA");
    expect(edge.weight).toBe(3);
    expect(edge.correlation).toBeGreaterThan(0);
  });

  it("centers on symbol when provided", async () => {
    // Call sequence for symbol-centered: 1) getCoOccurringSymbols, 2) pairwise edges, 3) appearance counts
    mockQueryRaw
      .mockResolvedValueOnce([{ symbol: "TSLA", coCount: 3, targetTotal: 5 }])
      .mockResolvedValueOnce([{ source: "AAPL", target: "TSLA", weight: 3 }])
      .mockResolvedValueOnce([
        { symbol: "AAPL", cnt: 5 },
        { symbol: "TSLA", cnt: 4 },
      ]);

    mockFindManyTicker.mockResolvedValue([
      makeTicker("AAPL", 70, "CONFIRMED", daysAgo(1)),
      makeTicker("TSLA", 65, "FORMING", daysAgo(1)),
    ]);

    const res = await GET(makeRequest({ symbol: "AAPL" }));
    const body = await res.json();

    expect(body.centerSymbol).toBe("AAPL");
    expect(body.nodes.length).toBeGreaterThan(0);
  });

  it("validates parameters", async () => {
    const res = await GET(makeRequest({ days: "0" }));
    expect(res.status).toBe(400);

    const res2 = await GET(makeRequest({ maxNodes: "100" }));
    expect(res2.status).toBe(400);

    const res3 = await GET(makeRequest({ stage: "INVALID" }));
    expect(res3.status).toBe(400);
  });

  it("caps maxNodes at 50", async () => {
    const res = await GET(makeRequest({ maxNodes: "51" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const { getCurrentUserId } = await import("@/lib/auth");
    (getCurrentUserId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Not authenticated"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });
});
