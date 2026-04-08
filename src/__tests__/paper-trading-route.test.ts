import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

const mockTickerPerformanceFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tickerPerformance: {
      findMany: (...args: unknown[]) => mockTickerPerformanceFindMany(...args),
    },
  },
}));

vi.mock("@/lib/spy-benchmark", () => ({
  fetchSpyTotalReturnDecimal: vi.fn().mockResolvedValue(0.05),
  SPY_BENCHMARK_SYMBOL: "SPY",
}));

const { GET } = await import("@/app/api/paper-trading/route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/paper-trading");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/paper-trading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated (getCurrentUserId throws)", async () => {
    // Before the bug fix (2453e7b) this used getOptionalUserId which did not
    // enforce auth. After the fix it uses getCurrentUserId, which throws on
    // unauthenticated requests and handleApiError maps that to 401.
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    // Confirm DB was never touched — auth must gate before any data access
    expect(mockTickerPerformanceFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid minScore value", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await GET(makeRequest({ minScore: "55" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("minScore");
    expect(mockTickerPerformanceFindMany).not.toHaveBeenCalled();
  });

  it("returns 200 with empty trades when no performance records exist", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockTickerPerformanceFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ minScore: "70" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trades).toEqual([]);
    expect(json.summary).toBeDefined();
    expect(json.benchmark).toBeDefined();
  });
});
