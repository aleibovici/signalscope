import { describe, it, expect } from "vitest";
import { computeNetPremium } from "@/lib/harvester/sources/options-flow";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockContract {
  contractSymbol?: string;
  strike?: number;
  volume?: number;
  openInterest?: number;
  expiration?: Date;
  impliedVolatility?: number;
  inTheMoney?: boolean;
  bid?: number;
  ask?: number;
  lastPrice?: number;
}

function contract(overrides: Partial<MockContract> = {}): MockContract {
  return {
    contractSymbol: "TEST",
    strike: 100,
    volume: 0,
    openInterest: 0,
    expiration: new Date(),
    impliedVolatility: 0.3,
    inTheMoney: false,
    ...overrides,
  };
}

function chain(calls: MockContract[], puts: MockContract[]) {
  return {
    quote: { regularMarketPrice: 100 },
    options: [{ calls, puts }],
  } as unknown as Parameters<typeof computeNetPremium>[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("computeNetPremium", () => {
  it("returns null when options array is empty", () => {
    const result = computeNetPremium({ quote: {}, options: [] } as unknown as Parameters<typeof computeNetPremium>[0]);
    expect(result).toBeNull();
  });

  it("returns null when all contracts have zero volume", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 0, bid: 2, ask: 3 })],
        [contract({ volume: 0, bid: 1, ask: 2 })],
      ),
    );
    expect(result).toBeNull();
  });

  it("returns null when all prices are zero/missing", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 100, bid: 0, ask: 0, lastPrice: 0 })],
        [contract({ volume: 100, bid: 0, ask: 0, lastPrice: 0 })],
      ),
    );
    expect(result).toBeNull();
  });

  it("calculates positive net premium when calls dominate", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 1000, bid: 2.0, ask: 2.2 })], // mid=2.1, prem = 1000*2.1*100 = 210000
        [contract({ volume: 500, bid: 1.0, ask: 1.2 })],   // mid=1.1, prem = 500*1.1*100 = 55000
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(Math.round(210000 - 55000)); // 155000
    expect(result!.callPremiumRatio).toBeCloseTo(210000 / (210000 + 55000), 3);
  });

  it("calculates negative net premium when puts dominate", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 100, bid: 1.0, ask: 1.0 })],   // mid=1.0, prem = 100*1.0*100 = 10000
        [contract({ volume: 2000, bid: 3.0, ask: 3.0 })],   // mid=3.0, prem = 2000*3.0*100 = 600000
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(Math.round(10000 - 600000)); // -590000
    expect(result!.callPremiumRatio).toBeCloseTo(10000 / (10000 + 600000), 3);
  });

  it("uses lastPrice as fallback when bid/ask are missing", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 100, lastPrice: 5.0 })], // no bid/ask, prem = 100*5.0*100 = 50000
        [],
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(50000);
    expect(result!.callPremiumRatio).toBe(1);
  });

  it("uses lastPrice when bid is zero", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 200, bid: 0, ask: 4.0, lastPrice: 3.0 })], // bid=0 → use lastPrice=3.0
        [],
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(200 * 3.0 * 100); // 60000
  });

  it("skips contracts with zero or negative mid price", () => {
    const result = computeNetPremium(
      chain(
        [
          contract({ volume: 100, bid: 0, ask: 0, lastPrice: 0 }),  // skipped (mid=0)
          contract({ volume: 100, bid: 2.0, ask: 2.0 }),             // mid=2.0, prem = 20000
        ],
        [],
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(20000);
  });

  it("aggregates across multiple call and put contracts", () => {
    const result = computeNetPremium(
      chain(
        [
          contract({ volume: 100, bid: 1.0, ask: 1.0 }),  // 10000
          contract({ volume: 200, bid: 2.0, ask: 2.0 }),  // 40000
        ],
        [
          contract({ volume: 50, bid: 0.5, ask: 0.5 }),   // 2500
          contract({ volume: 150, bid: 1.5, ask: 1.5 }),  // 22500
        ],
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(Math.round(50000 - 25000)); // 25000
    expect(result!.callPremiumRatio).toBeCloseTo(50000 / 75000, 3);
  });

  it("handles only calls with no puts", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 500, bid: 4.0, ask: 4.0 })], // 200000
        [],
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(200000);
    expect(result!.callPremiumRatio).toBe(1);
  });

  it("handles only puts with no calls", () => {
    const result = computeNetPremium(
      chain(
        [],
        [contract({ volume: 500, bid: 4.0, ask: 4.0 })], // 200000
      ),
    );
    expect(result).not.toBeNull();
    expect(result!.netPremium).toBe(-200000);
    expect(result!.callPremiumRatio).toBe(0);
  });

  it("rounds netPremium to integer and callPremiumRatio to 4 decimals", () => {
    const result = computeNetPremium(
      chain(
        [contract({ volume: 333, bid: 1.11, ask: 1.13 })], // mid=1.12, prem=333*1.12*100=37296
        [contract({ volume: 777, bid: 0.99, ask: 1.01 })], // mid=1.00, prem=777*1.00*100=77700
      ),
    );
    expect(result).not.toBeNull();
    expect(Number.isInteger(result!.netPremium)).toBe(true);
    // callPremiumRatio should have at most 4 decimal places
    const decimalPlaces = result!.callPremiumRatio.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(4);
  });
});
