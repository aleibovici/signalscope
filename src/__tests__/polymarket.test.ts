import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchPolymarketSignals } = await import("@/lib/harvester/sources/polymarket");

// --- Helpers ---

function mkMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    question: "Will Apple (AAPL) close above $250 end of March?",
    slug: "aapl-above-250",
    active: true,
    closed: false,
    volume: "10000",
    volume24hr: "2000",
    liquidity: "5000",
    outcomePrices: '["0.75", "0.25"]',
    outcomes: '["Yes", "No"]',
    endDate: "2026-03-31T20:00:00Z",
    ...overrides,
  };
}

function mkEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    slug: "aapl-above-in-march",
    title: "Will Apple (AAPL) close above ___ end of March?",
    markets: [mkMarket()],
    ...overrides,
  };
}

function mockOk(events: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ events }) };
}

function mockEmpty() {
  return mockOk([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// isRelevantMarket (tested through fetchPolymarketSignals)
// ============================================================
describe("market matching", () => {
  it("matches parenthesized ticker with price keyword", async () => {
    mockFetch.mockResolvedValue(mockOk([mkEvent()]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    expect(signals[0].symbol).toBe("AAPL");
    expect(signals[0].source).toBe("POLYMARKET");
  });

  it("matches parenthesized ticker with catalyst keyword (earnings)", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "Will Nike (NKE) beat quarterly earnings?",
        markets: [mkMarket({
          question: "Will Nike (NKE) beat quarterly earnings?",
          volume: "8000",
          volume24hr: "1500",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["NKE"]);
    expect(signals).toHaveLength(1);
    expect(signals[0].title).toContain("earnings");
  });

  it("matches catalyst keywords: merger, FDA, S&P 500, launch", async () => {
    const catalysts = [
      { q: "Will ACME (ACME) merger with Corp close?", kw: "merger" },
      { q: "Will ACME (ACME) get FDA approval?", kw: "FDA" },
      { q: "Will ACME (ACME) be added to S&P 500?", kw: "S&P" },
      { q: "Will ACME (ACME) launch new product?", kw: "launch" },
    ];

    for (const { q, kw } of catalysts) {
      mockFetch.mockResolvedValue(mockOk([
        mkEvent({
          title: q,
          markets: [mkMarket({ question: q, volume: "6000" })],
        }),
      ]));

      const signals = await fetchPolymarketSignals(["ACME"]);
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals[0].title?.toLowerCase()).toContain(kw.toLowerCase());
    }
  });

  it("matches 3+ char ticker via word boundary (no parentheses)", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "NVDA price prediction",
        markets: [mkMarket({
          question: "Will NVDA close above $200?",
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["NVDA"]);
    expect(signals).toHaveLength(1);
  });

  it("rejects short tickers (1-2 chars) without parenthesized form", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "Some event about C language",
        markets: [mkMarket({
          question: "Will C be popular above $100?",
          volume: "50000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["C"]);
    expect(signals).toHaveLength(0);
  });

  it("matches short tickers in parenthesized form", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "Will Citigroup (C) close above $60?",
        markets: [mkMarket({
          question: "Will Citigroup (C) close above $60?",
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["C"]);
    expect(signals).toHaveLength(1);
    expect(signals[0].symbol).toBe("C");
  });

  it("rejects questions without ticker symbol", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "Will Bitcoin hit $100K?",
        markets: [mkMarket({
          question: "Will Bitcoin close above $100K?",
          volume: "500000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("rejects questions without price or catalyst keywords", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        title: "Will Apple (AAPL) be featured at CES?",
        markets: [mkMarket({
          question: "Will Apple (AAPL) be featured at CES?",
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("skips closed markets", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({ closed: true, volume: "100000" })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("skips inactive markets", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({ active: false, volume: "100000" })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });
});

// ============================================================
// Probability parsing
// ============================================================
describe("probability parsing", () => {
  it("parses Yes probability from JSON-encoded outcomes", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          outcomePrices: '["0.82", "0.18"]',
          outcomes: '["Yes", "No"]',
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals[0].marketProbability).toBe(0.82);
  });

  it("handles bracket markets (returns highest probability)", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [
          mkMarket({
            question: "Will Apple (AAPL) close above $240?",
            outcomePrices: '["0.30", "0.70"]',
            outcomes: '["Yes", "No"]',
            volume: "3000",
            volume24hr: "500",
          }),
          mkMarket({
            question: "Will Apple (AAPL) close above $230?",
            outcomePrices: '["0.65", "0.35"]',
            outcomes: '["Yes", "No"]',
            volume: "4000",
            volume24hr: "600",
          }),
        ],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    // Best probability across the two markets: 0.65 (Yes on $230)
    expect(signals[0].marketProbability).toBe(0.65);
  });

  it("handles empty outcomePrices gracefully", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          outcomePrices: "[]",
          outcomes: "[]",
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    // Still emits signal but with 0 probability
    expect(signals[0].marketProbability).toBe(0);
  });

  it("handles malformed JSON in outcomePrices", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          outcomePrices: "not json",
          outcomes: "not json",
          volume: "10000",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals[0].marketProbability).toBe(0);
  });
});

// ============================================================
// Event-level volume aggregation
// ============================================================
describe("volume thresholds", () => {
  it("emits signal when event total volume >= $5K", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [
          mkMarket({ question: "Will Apple (AAPL) close above $230?", volume: "3000", volume24hr: "0" }),
          mkMarket({ question: "Will Apple (AAPL) close above $240?", volume: "2500", volume24hr: "0" }),
        ],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    // Sum: 3000 + 2500 = 5500 >= 5000 threshold
    expect(signals[0].marketVolume24hr).toBe(0);
  });

  it("emits signal when event 24h volume >= $1K", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          volume: "2000",
          volume24hr: "1200",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    // total vol < 5K but 24h vol >= 1K
  });

  it("skips event when volume below both thresholds", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          volume: "3000",
          volume24hr: "500",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("aggregates volume across multiple active markets in an event", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [
          mkMarket({ question: "Will Apple (AAPL) close above $230?", volume: "1500", volume24hr: "400" }),
          mkMarket({ question: "Will Apple (AAPL) close above $240?", volume: "1500", volume24hr: "400" }),
          mkMarket({ question: "Will Apple (AAPL) close above $250?", volume: "1500", volume24hr: "400" }),
          // closed market should NOT count
          mkMarket({ question: "Will Apple (AAPL) close above $220?", volume: "50000", volume24hr: "10000", closed: true }),
        ],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    // 3 active markets: 1500*3 = 4500 total (< 5K), 400*3 = 1200 24h (>= 1K)
    expect(signals[0].marketVolume24hr).toBe(1200);
  });

  it("handles undefined volume fields (all parse as 0 → below thresholds)", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          volume: undefined,
          volume24hr: undefined,
          liquidity: undefined,
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("handles null volume fields — does not produce NaN (JSON serializes NaN as null)", async () => {
    // When volume24hr is null but total volume >= $5K, signal is emitted with volume24hr=0 (not NaN)
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [mkMarket({
          volume: "6000",
          volume24hr: null,
          liquidity: null,
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1);
    expect(signals[0].marketVolume24hr).toBe(0);
    expect(Number.isFinite(signals[0].marketVolume24hr!)).toBe(true);
  });
});

// ============================================================
// Signal output shape
// ============================================================
describe("signal output", () => {
  it("includes all required fields", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        slug: "aapl-march-2026",
        title: "Will Apple (AAPL) close above ___ end of March?",
        markets: [mkMarket({
          volume: "10000",
          volume24hr: "2000",
          liquidity: "5000",
          outcomePrices: '["0.75", "0.25"]',
          outcomes: '["Yes", "No"]',
          endDate: "2026-03-31T20:00:00Z",
        })],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    const s = signals[0];

    expect(s.symbol).toBe("AAPL");
    expect(s.source).toBe("POLYMARKET");
    expect(s.title).toContain("Prediction market:");
    expect(s.body).toContain("active markets");
    expect(s.body).toContain("Vol 24h:");
    expect(s.body).toContain("Top prob:");
    expect(s.url).toBe("https://polymarket.com/event/aapl-march-2026");
    expect(s.marketProbability).toBe(0.75);
    expect(s.marketVolume24hr).toBe(2000);
    expect(s.marketLiquidity).toBe(5000);
    expect(s.marketEndDate).toBe("2026-03-31T20:00:00Z");
  });

  it("emits one signal per event, not per market", async () => {
    mockFetch.mockResolvedValue(mockOk([
      mkEvent({
        markets: [
          mkMarket({ question: "Will Apple (AAPL) close above $230?", volume: "3000" }),
          mkMarket({ question: "Will Apple (AAPL) close above $240?", volume: "3000" }),
          mkMarket({ question: "Will Apple (AAPL) close above $250?", volume: "3000" }),
        ],
      }),
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(1); // One signal for the event, not 3
  });
});

// ============================================================
// Error handling and edge cases
// ============================================================
describe("error handling", () => {
  it("returns empty on HTTP error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("returns empty on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("returns empty when API returns no events", async () => {
    mockFetch.mockResolvedValue(mockOk([]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("handles event with no markets array", async () => {
    mockFetch.mockResolvedValue(mockOk([
      { id: "e1", slug: "test", title: "Test event" },
    ]));

    const signals = await fetchPolymarketSignals(["AAPL"]);
    expect(signals).toHaveLength(0);
  });

  it("processes multiple symbols in batches", async () => {
    mockFetch.mockResolvedValue(mockEmpty());

    await fetchPolymarketSignals(["AAPL", "NVDA", "TSLA"]);

    // One fetch call per symbol
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][0]).toContain("q=AAPL");
    expect(mockFetch.mock.calls[1][0]).toContain("q=NVDA");
    expect(mockFetch.mock.calls[2][0]).toContain("q=TSLA");
  });
});
