import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock yahoo-finance2
const mockQuote = vi.fn();
vi.mock("yahoo-finance2", () => {
  return {
    default: class {
      quote = mockQuote;
    },
  };
});

// Mock Finviz fetch to avoid real network calls
const fetchSpy = vi.spyOn(globalThis, "fetch");

const { fetchFundamentals } = await import("@/lib/harvester/fundamentals");

describe("fetchFundamentals — data extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Finviz returns null for all
    fetchSpy.mockResolvedValue(new Response("no data", { status: 404 }));
  });

  it("returns empty map for empty symbols", async () => {
    const result = await fetchFundamentals([]);
    expect(result.size).toBe(0);
  });

  it("extracts price, marketCap, exchange, name from Yahoo quote", async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        regularMarketPrice: 8.50,
        marketCap: 3_000_000_000,
        fullExchangeName: "NASDAQ",
        longName: "Peloton Interactive Inc",
        fiftyTwoWeekLow: 4.0,
        fiftyTwoWeekHigh: 15.0,
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    const pton = result.get("PTON")!;
    expect(pton.price).toBe(8.50);
    expect(pton.marketCap).toBe(3_000_000_000);
    expect(pton.exchange).toBe("NASDAQ");
    expect(pton.name).toBe("Peloton Interactive Inc");
    expect(pton.fiftyTwoWeekRange).toBe("4.00 - 15.00");
  });

  it("extracts sector when available", async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        regularMarketPrice: 8.50,
        marketCap: 3_000_000_000,
        sector: "Consumer Cyclical",
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    expect(result.get("PTON")!.sector).toBe("Consumer Cyclical");
  });

  it("extracts earningsDate from earningsTimestamp", async () => {
    // 1704067200 = 2024-01-01T00:00:00Z
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        regularMarketPrice: 8.50,
        earningsTimestamp: 1704067200,
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    expect(result.get("PTON")!.earningsDate).toBe("2024-01-01");
  });

  it("extracts floatShares and sharesOutstanding", async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        regularMarketPrice: 8.50,
        floatShares: 300_000_000,
        sharesOutstanding: 350_000_000,
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    const pton = result.get("PTON")!;
    expect(pton.floatShares).toBe(300_000_000);
    expect(pton.sharesOutstanding).toBe(350_000_000);
  });

  it("handles missing optional fields gracefully", async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        regularMarketPrice: 8.50,
        // No sector, earningsTimestamp, floatShares, sharesOutstanding
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    const pton = result.get("PTON")!;
    expect(pton.sector).toBeUndefined();
    expect(pton.earningsDate).toBeUndefined();
    expect(pton.floatShares).toBeNull();
    expect(pton.sharesOutstanding).toBeNull();
  });

  it("handles null price and marketCap", async () => {
    mockQuote.mockResolvedValueOnce([
      {
        symbol: "PTON",
        // No regularMarketPrice or marketCap
      },
    ]);

    const result = await fetchFundamentals(["PTON"]);
    const pton = result.get("PTON")!;
    expect(pton.price).toBeNull();
    expect(pton.marketCap).toBeNull();
  });
});
