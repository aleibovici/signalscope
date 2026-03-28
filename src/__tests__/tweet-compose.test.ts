import { describe, it, expect } from "vitest";
import { composeTickerTweet, selectDiversifiedTickers, type TickerDetail } from "@/lib/twitter/post";

const makeTicker = (overrides: Partial<TickerDetail> = {}): TickerDetail => ({
  symbol: "AAPL",
  recommendation: "Buy",
  catalyst: "CEO purchased $2M in shares, insider cluster detected",
  risks: "Elevated valuation, sector rotation risk",
  aiReasoning: "Multiple C-suite insiders buying simultaneously suggests strong conviction in near-term catalysts.",
  stage: "EARLY",
  opportunityScore: 85,
  aiScore: 78,
  price: 150.25,
  marketCap: 2_500_000_000,
  sector: "Technology",
  sourceCount: 4,
  ...overrides,
});

describe("composeTickerTweet", () => {
  it("stays within 280 characters", () => {
    const tweet = composeTickerTweet(makeTicker());
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("respects a lower max length for reply-safe composition", () => {
    const tweet = composeTickerTweet(makeTicker(), 235);
    expect(tweet.length).toBeLessThanOrEqual(235);
  });

  it("includes ticker symbol with $ prefix", () => {
    const tweet = composeTickerTweet(makeTicker({ symbol: "TSLA" }));
    expect(tweet).toContain("$TSLA");
  });

  it("includes recommendation", () => {
    const tweet = composeTickerTweet(makeTicker({ recommendation: "Strong Buy" }));
    expect(tweet).toContain("Strong Buy");
  });

  it("shows green emoji for Buy", () => {
    const tweet = composeTickerTweet(makeTicker({ recommendation: "Buy" }));
    expect(tweet).toContain("🟢");
  });

  it("shows green emoji for Strong Buy", () => {
    const tweet = composeTickerTweet(makeTicker({ recommendation: "Strong Buy" }));
    expect(tweet).toContain("🟢");
  });

  it("shows yellow emoji for Watch", () => {
    const tweet = composeTickerTweet(makeTicker({ recommendation: "Watch" }));
    expect(tweet).toContain("🟡");
  });

  it("shows red emoji for Avoid", () => {
    const tweet = composeTickerTweet(makeTicker({ recommendation: "Avoid" }));
    expect(tweet).toContain("🔴");
  });

  it("includes price when available", () => {
    const tweet = composeTickerTweet(makeTicker({ price: 42.5 }));
    expect(tweet).toContain("$42.50");
  });

  it("omits price from info line when null", () => {
    const tweet = composeTickerTweet(makeTicker({ price: null, tradeSetup: null }));
    // Info line is now line index 2 (after headline + hook)
    const infoLine = tweet.split("\n")[2];
    expect(infoLine).toMatch(/^\$/); // starts with market cap $
    expect(infoLine).not.toMatch(/^\$\d+\.\d{2} \|/); // no leading stock price
  });

  it("includes market cap formatted", () => {
    const tweet = composeTickerTweet(makeTicker({ marketCap: 2_500_000_000 }));
    expect(tweet).toContain("$2.5B");
  });

  it("formats trillion market caps", () => {
    const tweet = composeTickerTweet(makeTicker({ marketCap: 3_200_000_000_000 }));
    expect(tweet).toContain("$3.2T");
  });

  it("formats million market caps", () => {
    const tweet = composeTickerTweet(makeTicker({ marketCap: 450_000_000 }));
    expect(tweet).toContain("$450M");
  });

  it("includes sector", () => {
    const tweet = composeTickerTweet(makeTicker({ sector: "Healthcare" }));
    expect(tweet).toContain("Healthcare");
  });

  it("includes source count", () => {
    const tweet = composeTickerTweet(makeTicker({ sourceCount: 5 }));
    expect(tweet).toContain("5 sources");
  });

  it("includes AI score and opportunity score", () => {
    const tweet = composeTickerTweet(makeTicker({ aiScore: 82, opportunityScore: 91 }));
    expect(tweet).toContain("Signal: 82/100");
    expect(tweet).toContain("Opportunity: 91/100");
  });

  it("shows 'New Signal' for EARLY stage", () => {
    const tweet = composeTickerTweet(makeTicker({ stage: "EARLY" }));
    expect(tweet).toContain("New Signal");
  });

  it("shows 'Building' for FORMING stage", () => {
    const tweet = composeTickerTweet(makeTicker({ stage: "FORMING" }));
    expect(tweet).toContain("Building");
  });

  it("includes AI reasoning when space allows", () => {
    const tweet = composeTickerTweet(makeTicker({ aiReasoning: "Strong insider conviction signal." }));
    expect(tweet).toContain("Strong insider conviction signal.");
  });

  it("omits AI reasoning when null", () => {
    const tweet = composeTickerTweet(makeTicker({ aiReasoning: null }));
    expect(tweet).toContain("CEO purchased"); // catalyst still present
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("includes catalyst text", () => {
    const tweet = composeTickerTweet(makeTicker({ catalyst: "Massive insider buying" }));
    expect(tweet).toContain("Massive insider buying");
  });

  it("includes link to ticker page", () => {
    const tweet = composeTickerTweet(makeTicker({ symbol: "NVDA" }));
    expect(tweet).toContain("http://localhost:3000/ticker/NVDA");
  });

  it("handles long catalyst by truncating", () => {
    const longCatalyst = "A".repeat(200);
    const tweet = composeTickerTweet(makeTicker({ catalyst: longCatalyst }));
    expect(tweet.length).toBeLessThanOrEqual(280);
    expect(tweet).toContain("…");
  });

  it("handles penny stocks with 4 decimal price", () => {
    const tweet = composeTickerTweet(makeTicker({ price: 0.0042 }));
    expect(tweet).toContain("$0.0042");
  });

  it("handles missing optional fields", () => {
    const tweet = composeTickerTweet(
      makeTicker({ price: null, marketCap: null, sector: null, aiReasoning: null })
    );
    expect(tweet.length).toBeLessThanOrEqual(280);
    expect(tweet).toContain("$AAPL");
  });
});

describe("selectDiversifiedTickers", () => {
  const mkTicker = (symbol: string, marketCap: number | null, score: number): TickerDetail =>
    makeTicker({ symbol, marketCap, opportunityScore: score });

  it("picks top 2 from each market cap tier", () => {
    const candidates = [
      mkTicker("MICRO1", 100_000_000, 90),     // micro
      mkTicker("MICRO2", 200_000_000, 80),     // micro
      mkTicker("MICRO3", 50_000_000, 70),      // micro (should be excluded)
      mkTicker("SMALL1", 500_000_000, 85),     // small
      mkTicker("SMALL2", 1_000_000_000, 75),   // small
      mkTicker("MID1", 5_000_000_000, 88),     // mid
      mkTicker("LARGE1", 50_000_000_000, 82),  // large
      mkTicker("MEGA1", 500_000_000_000, 95),  // mega
    ];
    const result = selectDiversifiedTickers(candidates, 10);
    const symbols = result.map((t) => t.symbol);

    expect(symbols).toContain("MICRO1");
    expect(symbols).toContain("MICRO2");
    // MICRO3 may appear via backfill since only 8 candidates < maxTotal 10
    expect(symbols).toContain("SMALL1");
    expect(symbols).toContain("SMALL2");
    expect(symbols).toContain("MID1");
    expect(symbols).toContain("LARGE1");
    expect(symbols).toContain("MEGA1");
  });

  it("backfills from larger tiers when some tiers are empty", () => {
    const candidates = [
      mkTicker("MICRO1", 100_000_000, 90),
      mkTicker("MICRO2", 200_000_000, 80),
      mkTicker("MICRO3", 50_000_000, 70),
      mkTicker("MICRO4", 150_000_000, 60),
    ];
    const result = selectDiversifiedTickers(candidates, 4);
    expect(result).toHaveLength(4);
  });

  it("returns sorted by opportunityScore desc", () => {
    const candidates = [
      mkTicker("LOW", 100_000_000, 50),
      mkTicker("HIGH", 50_000_000_000, 95),
      mkTicker("MED", 5_000_000_000, 75),
    ];
    const result = selectDiversifiedTickers(candidates, 10);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].opportunityScore).toBeGreaterThanOrEqual(result[i].opportunityScore);
    }
  });

  it("respects maxTotal limit", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      mkTicker(`T${i}`, (i + 1) * 100_000_000, 90 - i)
    );
    const result = selectDiversifiedTickers(candidates, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("treats null market cap as micro", () => {
    const candidates = [
      mkTicker("UNKNOWN", null, 90),
      mkTicker("MICRO1", 100_000_000, 85),
      mkTicker("MICRO2", 200_000_000, 80),
    ];
    const result = selectDiversifiedTickers(candidates, 10);
    // UNKNOWN and MICRO1 are top 2 in micro tier
    const symbols = result.map((t) => t.symbol);
    expect(symbols).toContain("UNKNOWN");
    expect(symbols).toContain("MICRO1");
  });

  it("handles empty candidates", () => {
    expect(selectDiversifiedTickers([], 10)).toEqual([]);
  });

  it("no duplicates in output", () => {
    const candidates = [
      mkTicker("A", 100_000_000, 90),
      mkTicker("B", 500_000_000, 85),
      mkTicker("C", 5_000_000_000, 80),
    ];
    const result = selectDiversifiedTickers(candidates, 10);
    const symbols = result.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
