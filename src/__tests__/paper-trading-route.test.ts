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

// Named mocks for spy-benchmark — allows individual tests to override return values
const mockFetchSpyTotalReturnDecimal = vi.fn();
const mockFetchSpyDailyBars = vi.fn();
const mockSpyReturnForTrade = vi.fn();

vi.mock("@/lib/spy-benchmark", () => ({
  fetchSpyTotalReturnDecimal: (...args: unknown[]) => mockFetchSpyTotalReturnDecimal(...args),
  fetchSpyDailyBars: (...args: unknown[]) => mockFetchSpyDailyBars(...args),
  spyReturnForTrade: (...args: unknown[]) => mockSpyReturnForTrade(...args),
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

// ── Test-data helper ──────────────────────────────────────────────────────────

/**
 * Builds a minimal TickerPerformance-shaped record for paper-trading route tests.
 * `ageDays` is derived from `createdAt` vs the current clock when the route runs.
 */
function makeRecord({
  symbol = "XYZ",
  createdAt,
  snapped7dAt = null,
  return7d = null as number | null,
  price7d = null as number | null,
  aiScore = 75,
}: {
  symbol?: string;
  createdAt: Date;
  snapped7dAt?: Date | null;
  return7d?: number | null;
  price7d?: number | null;
  aiScore?: number;
}) {
  return {
    detectionPrice: 100,
    corporateActionDetected: false,
    return1d: null, price1d: null,
    return3d: null, price3d: null,
    return7d, price7d,
    return30d: null, price30d: null,
    snapped1dAt: null, snapped3dAt: null,
    snapped7dAt,
    snapped30dAt: null,
    validatedTicker: {
      aiScore,
      opportunityScore: 50,
      stage: "CONFIRMED",
      symbol,
      name: `${symbol} Corp`,
      catalyst: "Test catalyst",
      createdAt,
    },
  };
}

describe("GET /api/paper-trading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore stable defaults after clearAllMocks wipes call history
    mockFetchSpyTotalReturnDecimal.mockResolvedValue(0.05);
    mockFetchSpyDailyBars.mockResolvedValue([]);
    mockSpyReturnForTrade.mockReturnValue(null);
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

  // ── lookbackDays validation ──────────────────────────────────────────────

  it("returns 400 for lookbackDays not in the valid set (e.g. 10)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await GET(makeRequest({ lookbackDays: "10" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("lookbackDays");
    // DB must not be touched — validation gates before any data access
    expect(mockTickerPerformanceFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 for non-integer lookbackDays (e.g. '7.5')", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await GET(makeRequest({ lookbackDays: "7.5" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("lookbackDays");
  });

  it("accepts valid lookbackDays=7 and returns 200", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockTickerPerformanceFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ lookbackDays: "7" }));
    expect(res.status).toBe(200);
  });

  it("defaults lookbackDays to 14 when the param is absent", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockTickerPerformanceFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    // benchmark.windowStart/windowEnd are ISO date strings (YYYY-MM-DD).
    // The difference between them should be exactly 14 calendar days.
    const startMs = new Date(json.benchmark.windowStart).getTime();
    const endMs = new Date(json.benchmark.windowEnd).getTime();
    const windowDays = (endMs - startMs) / 86400000;
    expect(windowDays).toBe(14);
  });

  // ── window filtering: closed trades outside the window are dropped ────────

  it("excludes closed trades whose closing date precedes the lookback window", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    const now = Date.now();

    // Trade A: detected 15d ago, closed 9d ago (before the 7d window start)
    // With lookbackDays=7, windowStart = now − 7d.  closingAtMs = snapped7dAt = now−9d < windowStart → FILTERED
    const closedBeforeWindow = makeRecord({
      symbol: "OLD",
      createdAt: new Date(now - 15 * 86400000), // ageDays ≈ 15 → CLOSED
      snapped7dAt: new Date(now - 9 * 86400000), // closed 9d ago
      return7d: 0.15,
      price7d: 115,
    });

    // Trade B: detected 3d ago → OPEN (ageDays < 7); always included
    const openTrade = makeRecord({
      symbol: "NEW",
      createdAt: new Date(now - 3 * 86400000), // ageDays ≈ 3 → OPEN
      snapped7dAt: null,
    });

    mockTickerPerformanceFindMany.mockResolvedValue([closedBeforeWindow, openTrade]);

    const res = await GET(makeRequest({ lookbackDays: "7" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    const symbols = json.trades.map((t: { symbol: string }) => t.symbol);
    expect(symbols).not.toContain("OLD");
    expect(symbols).toContain("NEW");
  });

  it("includes a closed trade whose closing date falls inside the lookback window", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    const now = Date.now();

    // Detected 15d ago, closed 5d ago — within the 7d lookback window
    const closedInsideWindow = makeRecord({
      symbol: "IN",
      createdAt: new Date(now - 15 * 86400000),
      snapped7dAt: new Date(now - 5 * 86400000), // 5d ago > windowStart (7d ago)
      return7d: 0.08,
      price7d: 108,
    });

    mockTickerPerformanceFindMany.mockResolvedValue([closedInsideWindow]);

    const res = await GET(makeRequest({ lookbackDays: "7" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trades.map((t: { symbol: string }) => t.symbol)).toContain("IN");
  });

  // ── matchedReturnPct: per-trade SPY hold-matched average ──────────────────

  it("computes matchedReturnPct in benchmark as average of per-trade spyReturnPct values", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    const now = Date.now();

    // Two CLOSED trades within the 14d window with known return7d
    const tradeA = makeRecord({
      symbol: "AAA",
      createdAt: new Date(now - 15 * 86400000),
      snapped7dAt: new Date(now - 5 * 86400000),
      return7d: 0.10, price7d: 110,
    });
    const tradeB = makeRecord({
      symbol: "BBB",
      createdAt: new Date(now - 20 * 86400000),
      snapped7dAt: new Date(now - 10 * 86400000),
      return7d: 0.05, price7d: 105,
    });

    mockTickerPerformanceFindMany.mockResolvedValue([tradeA, tradeB]);
    // SPY returned 3% for each trade's hold period
    mockSpyReturnForTrade.mockReturnValue(0.03);

    const res = await GET(makeRequest({ lookbackDays: "14" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Both trades have returnPct set and spyReturnPct=0.03 → matchedReturnPct = (0.03+0.03)/2 = 0.03
    expect(json.benchmark.matchedReturnPct).toBeCloseTo(0.03, 5);
  });

  it("returns matchedReturnPct=null when no trades have a SPY matched return", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    // spyReturnForTrade returns null by default (set in beforeEach)
    mockTickerPerformanceFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.benchmark.matchedReturnPct).toBeNull();
  });
});
