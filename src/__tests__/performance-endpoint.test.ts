/**
 * Tests for GET /api/performance — focused on the totalTracked bug fix.
 *
 * Bug: totalTracked previously counted ALL records (including those with no
 * return data yet). Fixed to count only recordsWithReturn (records where
 * the chosen return column is not null).
 *
 * Coverage:
 *  - totalTracked reflects only records that have actual return data
 *  - totalTracked = 0 when all records have null returns
 *  - Validation: invalid days param → 400
 *  - Empty DB → zero-valued response
 *  - Response shape has required top-level keys
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Auth mock ──────────────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  getOptionalUserId: vi.fn().mockResolvedValue(null),
}));

// ── Prisma mock ────────────────────────────────────────────────────────────────
const mockTickerPerformanceFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tickerPerformance: {
      findMany: (...args: unknown[]) => mockTickerPerformanceFindMany(...args),
    },
  },
}));

// ── stage-labels mock (avoids pulling in full lib) ─────────────────────────────
vi.mock("@/lib/stage-labels", () => ({
  stageLabel: (s: string) => s,
}));

const { GET } = await import("@/app/api/performance/route");

// ── Fixture helpers ────────────────────────────────────────────────────────────

const SCORING_CUTOFF = new Date("2026-03-16T00:00:00Z");
const RECENT = new Date(SCORING_CUTOFF.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days after cutoff

interface MakeRecordOpts {
  symbol?: string;
  return7d?: number | null;
  return1d?: number | null;
  return3d?: number | null;
  return30d?: number | null;
  stage?: string;
  aiScore?: number;
  opportunityScore?: number;
  detectionPrice?: number;
  createdAt?: Date;
}

function makeRecord(opts: MakeRecordOpts = {}) {
  const {
    symbol = "AAPL",
    return7d = 5.2,
    return1d = null,
    return3d = null,
    return30d = null,
    stage = "EARLY",
    aiScore = 80,
    opportunityScore = 60,
    detectionPrice = 100,
    createdAt = RECENT,
  } = opts;
  return {
    symbol,
    detectionPrice,
    return1d,
    return3d,
    return7d,
    return30d,
    price1d: null,
    price3d: null,
    price7d: return7d !== null ? detectionPrice * (1 + return7d / 100) : null,
    price30d: null,
    createdAt,
    validatedTicker: {
      aiScore,
      opportunityScore,
      stage,
      signalType: "reddit",
      recommendation: "Buy",
      createdAt,
    },
  };
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/performance");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/performance — validation", () => {
  it("returns 400 for an invalid days value", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest({ days: "5" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid days/i);
  });

  it("returns 400 for a non-numeric days value", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest({ days: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 for valid days values 1, 3, 7, 30", async () => {
    for (const days of ["1", "3", "7", "30"]) {
      mockTickerPerformanceFindMany.mockResolvedValue([]);
      const res = await GET(makeRequest({ days }));
      expect(res.status).toBe(200);
    }
  });
});

describe("GET /api/performance — empty DB", () => {
  it("returns zero-valued summary when no records exist", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest({ days: "7" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.totalTracked).toBe(0);
    expect(json.summary.current.count).toBe(0);
    expect(json.summary.prior.count).toBe(0);
    expect(json.cohorts).toEqual([]);
    expect(json.dailyReturns).toEqual([]);
  });

  it("returns all required top-level keys even when empty", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();
    for (const key of [
      "summary", "cohorts", "dailyReturns", "overall", "confirmed",
      "emerging", "byStage", "byType", "byScoreRange", "byOpportunityScoreRange",
      "bestPerformers", "worstPerformers",
    ]) {
      expect(json).toHaveProperty(key);
    }
  });
});

describe("GET /api/performance — totalTracked bug fix", () => {
  /**
   * Before the fix, totalTracked = records.length (all records, even those
   * without a return value for the selected horizon).
   * After the fix, totalTracked = recordsWithReturn.length (only records
   * that have a non-null return for the selected horizon).
   */

  it("totalTracked counts only records with a non-null return for the selected horizon", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return7d: 10.0 }),  // has return → counted
      makeRecord({ symbol: "MSFT", return7d: -3.5 }),  // has return → counted
      makeRecord({ symbol: "TSLA", return7d: null }),   // no return yet → NOT counted
    ]);

    const res = await GET(makeRequest({ days: "7" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    // Only 2 of 3 records have a non-null return7d
    expect(json.summary.totalTracked).toBe(2);
  });

  it("totalTracked is 0 when all records have null returns for the selected horizon", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return7d: null }),
      makeRecord({ symbol: "MSFT", return7d: null }),
    ]);

    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();

    expect(json.summary.totalTracked).toBe(0);
  });

  it("totalTracked equals total records when all have non-null returns", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return7d: 5.0 }),
      makeRecord({ symbol: "MSFT", return7d: -2.0 }),
      makeRecord({ symbol: "NVDA", return7d: 15.0 }),
    ]);

    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();

    expect(json.summary.totalTracked).toBe(3);
  });

  it("totalTracked respects the selected days horizon (return1d vs return7d)", async () => {
    // Record has return1d but NOT return7d
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return1d: 2.5, return7d: null }),
    ]);

    // With days=7: return7d is null → not counted
    const res7 = await GET(makeRequest({ days: "7" }));
    const json7 = await res7.json();
    expect(json7.summary.totalTracked).toBe(0);

    // With days=1: return1d is non-null → counted
    const res1 = await GET(makeRequest({ days: "1" }));
    const json1 = await res1.json();
    expect(json1.summary.totalTracked).toBe(1);
  });
});

describe("GET /api/performance — overall stats", () => {
  it("overall.count matches recordsWithReturn, not total records", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return7d: 10.0 }),
      makeRecord({ symbol: "MSFT", return7d: null }),  // excluded
      makeRecord({ symbol: "NVDA", return7d: -5.0 }),
    ]);

    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();

    expect(json.overall.count).toBe(2);
  });

  it("computes positive winRate correctly", async () => {
    mockTickerPerformanceFindMany.mockResolvedValue([
      makeRecord({ symbol: "AAPL", return7d: 10.0 }),  // win
      makeRecord({ symbol: "MSFT", return7d: 5.0 }),   // win
      makeRecord({ symbol: "NVDA", return7d: -3.0 }),  // loss
    ]);

    const res = await GET(makeRequest({ days: "7" }));
    const json = await res.json();

    expect(json.overall.winRate).toBeCloseTo(2 / 3, 5);
  });
});
