import { describe, it, expect } from "vitest";
import {
  pearsonCorrelation,
  buildDailyPriceMap,
  computeDailyReturns,
  alignReturns,
} from "@/lib/price-correlation";

describe("pearsonCorrelation", () => {
  it("returns 1 for perfectly correlated data", () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfectly inversely correlated data", () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(-1, 5);
  });

  it("returns ~0 for uncorrelated data", () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 1, 5, 3];
    const r = pearsonCorrelation(xs, ys);
    expect(r).not.toBeNull();
    expect(Math.abs(r!)).toBeLessThan(0.5);
  });

  it("returns null when fewer than minDataPoints", () => {
    expect(pearsonCorrelation([1, 2], [3, 4])).toBeNull();
    expect(pearsonCorrelation([1, 2, 3], [4, 5, 6], 5)).toBeNull();
  });

  it("returns null when arrays have different lengths", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [1, 2, 3])).toBeNull();
  });

  it("returns null when there is no variance", () => {
    expect(pearsonCorrelation([5, 5, 5, 5, 5], [1, 2, 3, 4, 5])).toBeNull();
  });

  it("handles negative values", () => {
    const xs = [-2, -1, 0, 1, 2];
    const ys = [-4, -2, 0, 2, 4];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it("respects custom minDataPoints", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6], 3)).toBeCloseTo(1, 5);
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6], 4)).toBeNull();
  });
});

describe("buildDailyPriceMap", () => {
  it("groups snapshots by symbol and date", () => {
    const snapshots = [
      { symbol: "AAPL", price: 150, createdAt: new Date("2026-03-01T10:00:00Z") },
      { symbol: "AAPL", price: 152, createdAt: new Date("2026-03-02T10:00:00Z") },
      { symbol: "TSLA", price: 200, createdAt: new Date("2026-03-01T10:00:00Z") },
    ];

    const result = buildDailyPriceMap(snapshots);
    expect(result.size).toBe(2);
    expect(result.get("AAPL")!.get("2026-03-01")).toBe(150);
    expect(result.get("AAPL")!.get("2026-03-02")).toBe(152);
    expect(result.get("TSLA")!.get("2026-03-01")).toBe(200);
  });

  it("picks the latest snapshot when multiple exist on the same day", () => {
    const snapshots = [
      { symbol: "AAPL", price: 150, createdAt: new Date("2026-03-01T09:45:00Z") },
      { symbol: "AAPL", price: 155, createdAt: new Date("2026-03-01T16:05:00Z") },
      { symbol: "AAPL", price: 153, createdAt: new Date("2026-03-01T12:00:00Z") },
    ];

    const result = buildDailyPriceMap(snapshots);
    expect(result.get("AAPL")!.get("2026-03-01")).toBe(155);
  });

  it("returns empty map for empty input", () => {
    expect(buildDailyPriceMap([]).size).toBe(0);
  });
});

describe("computeDailyReturns", () => {
  it("computes returns from consecutive daily prices", () => {
    const priceMap = new Map([
      ["2026-03-01", 100],
      ["2026-03-02", 110],
      ["2026-03-03", 99],
    ]);

    const returns = computeDailyReturns(priceMap);
    expect(returns).toHaveLength(2);
    expect(returns[0].date).toBe("2026-03-02");
    expect(returns[0].ret).toBeCloseTo(0.1, 5);
    expect(returns[1].date).toBe("2026-03-03");
    expect(returns[1].ret).toBeCloseTo(-0.1, 5);
  });

  it("skips zero-price entries", () => {
    const priceMap = new Map([
      ["2026-03-01", 0],
      ["2026-03-02", 100],
    ]);

    const returns = computeDailyReturns(priceMap);
    expect(returns).toHaveLength(0);
  });

  it("sorts by date", () => {
    const priceMap = new Map([
      ["2026-03-03", 105],
      ["2026-03-01", 100],
      ["2026-03-02", 110],
    ]);

    const returns = computeDailyReturns(priceMap);
    expect(returns[0].date).toBe("2026-03-02");
    expect(returns[1].date).toBe("2026-03-03");
  });

  it("handles single price entry", () => {
    const priceMap = new Map([["2026-03-01", 100]]);
    expect(computeDailyReturns(priceMap)).toHaveLength(0);
  });
});

describe("alignReturns", () => {
  it("pairs returns by matching dates", () => {
    const returnsA = [
      { date: "2026-03-01", ret: 0.05 },
      { date: "2026-03-02", ret: -0.02 },
      { date: "2026-03-03", ret: 0.03 },
    ];
    const returnsB = [
      { date: "2026-03-01", ret: 0.04 },
      { date: "2026-03-03", ret: 0.02 },
    ];

    const { xs, ys } = alignReturns(returnsA, returnsB);
    expect(xs).toEqual([0.05, 0.03]);
    expect(ys).toEqual([0.04, 0.02]);
  });

  it("returns empty arrays when no dates overlap", () => {
    const returnsA = [{ date: "2026-03-01", ret: 0.05 }];
    const returnsB = [{ date: "2026-03-02", ret: 0.04 }];

    const { xs, ys } = alignReturns(returnsA, returnsB);
    expect(xs).toEqual([]);
    expect(ys).toEqual([]);
  });

  it("handles empty inputs", () => {
    expect(alignReturns([], []).xs).toEqual([]);
    expect(alignReturns([{ date: "2026-03-01", ret: 0.05 }], []).xs).toEqual([]);
  });
});

describe("end-to-end: snapshot → correlation", () => {
  it("computes positive correlation for tickers that move together", () => {
    const snapshots = [
      // AAPL and TSLA both go up then down
      { symbol: "AAPL", price: 100, createdAt: new Date("2026-03-01T16:00:00Z") },
      { symbol: "AAPL", price: 105, createdAt: new Date("2026-03-02T16:00:00Z") },
      { symbol: "AAPL", price: 102, createdAt: new Date("2026-03-03T16:00:00Z") },
      { symbol: "AAPL", price: 108, createdAt: new Date("2026-03-04T16:00:00Z") },
      { symbol: "AAPL", price: 110, createdAt: new Date("2026-03-05T16:00:00Z") },
      { symbol: "AAPL", price: 107, createdAt: new Date("2026-03-06T16:00:00Z") },
      { symbol: "TSLA", price: 200, createdAt: new Date("2026-03-01T16:00:00Z") },
      { symbol: "TSLA", price: 210, createdAt: new Date("2026-03-02T16:00:00Z") },
      { symbol: "TSLA", price: 205, createdAt: new Date("2026-03-03T16:00:00Z") },
      { symbol: "TSLA", price: 215, createdAt: new Date("2026-03-04T16:00:00Z") },
      { symbol: "TSLA", price: 220, createdAt: new Date("2026-03-05T16:00:00Z") },
      { symbol: "TSLA", price: 212, createdAt: new Date("2026-03-06T16:00:00Z") },
    ];

    const dailyPrices = buildDailyPriceMap(snapshots);
    const returnsAAPL = computeDailyReturns(dailyPrices.get("AAPL")!);
    const returnsTSLA = computeDailyReturns(dailyPrices.get("TSLA")!);
    const { xs, ys } = alignReturns(returnsAAPL, returnsTSLA);
    const r = pearsonCorrelation(xs, ys);

    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.8); // Strong positive correlation
  });

  it("computes negative correlation for tickers that move inversely", () => {
    const snapshots = [
      // AAPL goes up, TSLA goes down (and vice versa)
      { symbol: "AAPL", price: 100, createdAt: new Date("2026-03-01T16:00:00Z") },
      { symbol: "AAPL", price: 110, createdAt: new Date("2026-03-02T16:00:00Z") },
      { symbol: "AAPL", price: 105, createdAt: new Date("2026-03-03T16:00:00Z") },
      { symbol: "AAPL", price: 115, createdAt: new Date("2026-03-04T16:00:00Z") },
      { symbol: "AAPL", price: 108, createdAt: new Date("2026-03-05T16:00:00Z") },
      { symbol: "AAPL", price: 118, createdAt: new Date("2026-03-06T16:00:00Z") },
      { symbol: "TSLA", price: 200, createdAt: new Date("2026-03-01T16:00:00Z") },
      { symbol: "TSLA", price: 190, createdAt: new Date("2026-03-02T16:00:00Z") },
      { symbol: "TSLA", price: 195, createdAt: new Date("2026-03-03T16:00:00Z") },
      { symbol: "TSLA", price: 185, createdAt: new Date("2026-03-04T16:00:00Z") },
      { symbol: "TSLA", price: 192, createdAt: new Date("2026-03-05T16:00:00Z") },
      { symbol: "TSLA", price: 182, createdAt: new Date("2026-03-06T16:00:00Z") },
    ];

    const dailyPrices = buildDailyPriceMap(snapshots);
    const returnsAAPL = computeDailyReturns(dailyPrices.get("AAPL")!);
    const returnsTSLA = computeDailyReturns(dailyPrices.get("TSLA")!);
    const { xs, ys } = alignReturns(returnsAAPL, returnsTSLA);
    const r = pearsonCorrelation(xs, ys);

    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(-0.8); // Strong negative correlation
  });
});
