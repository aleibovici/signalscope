import { describe, it, expect } from "vitest";
import {
  composePerformanceTweet,
  composePerformanceSummary,
  type PerformanceHit,
} from "@/lib/twitter/performance";

const makeHit = (overrides: Partial<PerformanceHit> = {}): PerformanceHit => ({
  symbol: "NVDA",
  recommendation: "Strong Buy",
  stage: "EARLY",
  aiScore: 82,
  opportunityScore: 90,
  detectionPrice: 120.5,
  returnPct: 0.231,
  period: "7d",
  periodLabel: "7 days",
  catalyst: "Unusual options activity: 3x average call volume, concentrated OTM sweeps",
  sector: "Technology",
  marketCap: 3_200_000_000_000,
  detectedAt: new Date("2026-03-25"),
  ...overrides,
});

describe("composePerformanceTweet", () => {
  it("stays within 280 characters", () => {
    const tweet = composePerformanceTweet(makeHit());
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("includes symbol with $ prefix", () => {
    const tweet = composePerformanceTweet(makeHit({ symbol: "TSLA" }));
    expect(tweet).toContain("$TSLA");
  });

  it("includes formatted return percentage", () => {
    const tweet = composePerformanceTweet(makeHit({ returnPct: 0.231 }));
    expect(tweet).toContain("+23.1%");
  });

  it("includes the time period", () => {
    const tweet = composePerformanceTweet(makeHit({ period: "7d", periodLabel: "7 days" }));
    expect(tweet).toContain("7 days");
  });

  it("includes detection price", () => {
    const tweet = composePerformanceTweet(makeHit({ detectionPrice: 120.5 }));
    expect(tweet).toContain("$120.50");
  });

  it("includes scores", () => {
    const tweet = composePerformanceTweet(makeHit({ aiScore: 82, opportunityScore: 90 }));
    expect(tweet).toContain("Signal: 82/100");
    expect(tweet).toContain("Opportunity: 90/100");
  });

  it("includes hashtags", () => {
    const tweet = composePerformanceTweet(makeHit());
    expect(tweet).toContain("#Stocks");
    expect(tweet).toContain("#MarketSignals");
  });

  it("includes link to ticker page", () => {
    const tweet = composePerformanceTweet(makeHit({ symbol: "AAPL" }));
    expect(tweet).toContain("http://localhost:3000/ticker/AAPL");
  });

  it("includes 📈 emoji", () => {
    const tweet = composePerformanceTweet(makeHit());
    expect(tweet).toContain("📈");
  });

  it("handles penny stock price formatting", () => {
    const tweet = composePerformanceTweet(makeHit({ detectionPrice: 0.0045 }));
    expect(tweet).toContain("$0.0045");
  });

  it("includes market cap when available", () => {
    const tweet = composePerformanceTweet(makeHit({ marketCap: 3_200_000_000_000 }));
    expect(tweet).toContain("$3.2T");
  });

  it("handles small market caps", () => {
    const tweet = composePerformanceTweet(makeHit({ marketCap: 150_000_000 }));
    expect(tweet).toContain("$150M");
  });

  it("truncates long catalyst to stay under 280", () => {
    const longCatalyst = "A".repeat(300);
    const tweet = composePerformanceTweet(makeHit({ catalyst: longCatalyst }));
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("works with null catalyst", () => {
    const tweet = composePerformanceTweet(makeHit({ catalyst: null }));
    expect(tweet.length).toBeLessThanOrEqual(280);
    expect(tweet).toContain("$NVDA");
  });

  it("handles negative return (should not happen but safety)", () => {
    const tweet = composePerformanceTweet(makeHit({ returnPct: -0.05 }));
    expect(tweet).toContain("-5.0%");
  });

  it("includes 1d period label", () => {
    const tweet = composePerformanceTweet(makeHit({ period: "1d", periodLabel: "24 hours" }));
    expect(tweet).toContain("24 hours");
  });
});

describe("composePerformanceSummary", () => {
  it("stays within 280 characters", () => {
    const hits = [
      makeHit({ symbol: "NVDA", returnPct: 0.231, period: "7d" }),
      makeHit({ symbol: "AAPL", returnPct: 0.15, period: "30d" }),
      makeHit({ symbol: "TSLA", returnPct: 0.08, period: "3d" }),
    ];
    const tweet = composePerformanceSummary(hits);
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("includes header text", () => {
    const tweet = composePerformanceSummary([makeHit()]);
    expect(tweet).toContain("track record");
  });

  it("includes each ticker with return", () => {
    const hits = [
      makeHit({ symbol: "NVDA", returnPct: 0.231, period: "7d" }),
      makeHit({ symbol: "AAPL", returnPct: 0.15, period: "30d" }),
    ];
    const tweet = composePerformanceSummary(hits);
    expect(tweet).toContain("$NVDA +23.1% (7d)");
    expect(tweet).toContain("$AAPL +15.0% (30d)");
  });

  it("includes performance page link", () => {
    const tweet = composePerformanceSummary([makeHit()]);
    expect(tweet).toContain("http://localhost:3000/performance");
  });

  it("includes hashtags", () => {
    const tweet = composePerformanceSummary([makeHit()]);
    expect(tweet).toContain("#Stocks");
    expect(tweet).toContain("#TradingTools");
  });

  it("truncates to fit within 280 when many tickers", () => {
    const hits = Array.from({ length: 10 }, (_, i) =>
      makeHit({ symbol: `TK${i}`, returnPct: 0.1 + i * 0.05, period: "7d" })
    );
    const tweet = composePerformanceSummary(hits);
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("works with single ticker", () => {
    const tweet = composePerformanceSummary([makeHit({ symbol: "MSFT", returnPct: 0.12, period: "3d" })]);
    expect(tweet).toContain("$MSFT +12.0% (3d)");
    expect(tweet.length).toBeLessThanOrEqual(280);
  });
});
