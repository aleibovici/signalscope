import { describe, expect, it } from "vitest";
import { compareTickers, sortTickers } from "@/lib/signal-row-sort";
import type { ValidatedTickerData } from "@/hooks/use-scans";

function makeTicker(overrides: Partial<ValidatedTickerData>): ValidatedTickerData {
  return {
    id: "1",
    symbol: "AAA",
    price: 10,
    marketCap: 1e9,
    catalyst: null,
    risks: null,
    recommendation: "Watch",
    report: null,
    aiScore: 50,
    opportunityScore: 10,
    stage: "Emerging",
    signalCount: 2,
    sourceCount: 1,
    sources: ["REDDIT"],
    shortFloat: null,
    avgSentiment: null,
    firstSeenDaysAgo: 1,
    priorAppearances: 0,
    return7d: 0.05,
    exchange: null,
    wk52Lo: null,
    wk52Hi: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("signal-row-sort", () => {
  it("sorts by aiScore descending", () => {
    const tickers = [
      makeTicker({ id: "1", symbol: "LOW", aiScore: 40 }),
      makeTicker({ id: "2", symbol: "HIGH", aiScore: 90 }),
    ];
    const sorted = sortTickers(tickers, "aiScore", "desc");
    expect(sorted.map((t) => t.symbol)).toEqual(["HIGH", "LOW"]);
  });

  it("sorts symbols ascending by default direction", () => {
    const tickers = [
      makeTicker({ symbol: "ZZZ" }),
      makeTicker({ symbol: "AAA" }),
    ];
    const sorted = sortTickers(tickers, "symbol", "asc");
    expect(sorted.map((t) => t.symbol)).toEqual(["AAA", "ZZZ"]);
  });

  it("ranks recommendations with Strong Buy first when descending", () => {
    expect(
      compareTickers(
        makeTicker({ recommendation: "Strong Buy" }),
        makeTicker({ recommendation: "Watch" }),
        "recommendation",
      ),
    ).toBeGreaterThan(0);
  });

  it("pins bookmarked symbols when no sort key is set", () => {
    const tickers = [
      makeTicker({ symbol: "AAA" }),
      makeTicker({ symbol: "ZZZ" }),
    ];
    const sorted = sortTickers(tickers, null, "desc", {
      bookmarkedSymbols: new Set(["ZZZ"]),
    });
    expect(sorted.map((t) => t.symbol)).toEqual(["ZZZ", "AAA"]);
  });
});
