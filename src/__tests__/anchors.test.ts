import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tickerPerformance: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

import { getTradeBracket, _clearBracketCache, holdDaysForStage, HOLD_DAYS_BY_STAGE } from "@/lib/anchors";
import { TickerStage } from "@/generated/prisma/client";

beforeEach(() => {
  mockFindMany.mockReset();
  _clearBracketCache();
});

function row(stage: TickerStage, return7d: number) {
  return { return7d, validatedTicker: { stage } };
}

describe("getTradeBracket", () => {
  it("returns fallback when no data available", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const b = await getTradeBracket(TickerStage.EARLY);
    expect(b.source).toBe("fallback");
    expect(b.targetPct).toBeCloseTo(0.06, 5);
    expect(b.stopPct).toBeCloseTo(-0.04, 5); // -0.06 / 1.5
  });

  it("returns fallback when sample below MIN_SAMPLE (10)", async () => {
    const data = Array.from({ length: 9 }, () => row(TickerStage.EARLY, 0.05));
    mockFindMany.mockResolvedValueOnce(data);
    const b = await getTradeBracket(TickerStage.EARLY);
    expect(b.source).toBe("fallback");
  });

  it("computes P90 from sample when sufficient", async () => {
    // 20 EARLY rows: returns evenly spaced from 0.01 to 0.20.
    // P90 ≈ 0.183 (linear interp between idx 17 and 18 of sorted array of 20).
    const returns = Array.from({ length: 20 }, (_, i) => 0.01 * (i + 1));
    const data = returns.map((r) => row(TickerStage.EARLY, r));
    mockFindMany.mockResolvedValueOnce(data);
    const b = await getTradeBracket(TickerStage.EARLY);
    expect(b.source).toBe("anchor");
    expect(b.sampleSize).toBe(20);
    expect(b.targetPct).toBeGreaterThan(0.17);
    expect(b.targetPct).toBeLessThan(0.19);
    expect(b.stopPct).toBeCloseTo(-b.targetPct / 1.5, 5);
  });

  it("falls back when computed P90 is non-positive", async () => {
    // 15 rows all negative — strategy has no edge here right now.
    const data = Array.from({ length: 15 }, (_, i) => row(TickerStage.EARLY, -0.01 * (i + 1)));
    mockFindMany.mockResolvedValueOnce(data);
    const b = await getTradeBracket(TickerStage.EARLY);
    expect(b.source).toBe("fallback");
    expect(b.targetPct).toBeCloseTo(0.06, 5);
  });

  it("isolates stages — EARLY anchor doesn't pollute CONFIRMED", async () => {
    const earlyRows = Array.from({ length: 15 }, () => row(TickerStage.EARLY, 0.02));
    const confirmedRows = Array.from({ length: 15 }, () => row(TickerStage.CONFIRMED, 0.10));
    mockFindMany.mockResolvedValueOnce([...earlyRows, ...confirmedRows]);

    const early = await getTradeBracket(TickerStage.EARLY);
    const confirmed = await getTradeBracket(TickerStage.CONFIRMED);
    expect(early.source).toBe("anchor");
    expect(confirmed.source).toBe("anchor");
    expect(confirmed.targetPct).toBeGreaterThan(early.targetPct);
  });

  it("caches results — second call within TTL does not re-query", async () => {
    const data = Array.from({ length: 15 }, () => row(TickerStage.EARLY, 0.05));
    mockFindMany.mockResolvedValueOnce(data);
    await getTradeBracket(TickerStage.EARLY);
    await getTradeBracket(TickerStage.EARLY);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("stop maintains 1:1.5 risk:reward ratio", async () => {
    const returns = Array.from({ length: 20 }, (_, i) => 0.005 * (i + 1));
    mockFindMany.mockResolvedValueOnce(returns.map((r) => row(TickerStage.EARLY, r)));
    const b = await getTradeBracket(TickerStage.EARLY);
    const ratio = b.targetPct / Math.abs(b.stopPct);
    expect(ratio).toBeCloseTo(1.5, 5);
  });
});

describe("holdDaysForStage", () => {
  it("returns 5 days for EARLY (simulation showed decay past day 5)", () => {
    expect(holdDaysForStage(TickerStage.EARLY)).toBe(5);
  });

  it("returns 7 days for FORMING", () => {
    expect(holdDaysForStage(TickerStage.FORMING)).toBe(7);
  });

  it("returns 7 days for CONFIRMED", () => {
    expect(holdDaysForStage(TickerStage.CONFIRMED)).toBe(7);
  });

  it("never exceeds 7 days (ML model's max horizon)", () => {
    for (const stage of Object.keys(HOLD_DAYS_BY_STAGE) as TickerStage[]) {
      expect(HOLD_DAYS_BY_STAGE[stage]).toBeLessThanOrEqual(7);
    }
  });
});
