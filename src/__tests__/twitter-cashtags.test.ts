import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ticker-utils to track which extraction functions are called
const extractTickersMock = vi.fn().mockReturnValue([]);
const extractCashtagTickersMock = vi.fn().mockReturnValue([]);

vi.mock("@/lib/harvester/sources/ticker-utils", () => ({
  extractTickers: extractTickersMock,
  extractCashtagTickers: extractCashtagTickersMock,
}));

const { fetchTwitterSignals } = await import("@/lib/harvester/sources/twitter");

describe("fetchTwitterSignals — cashtag entity extraction", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, X_BEARER_TOKEN: "test-token" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("merges regex tickers and cashtag entity tickers", async () => {
    extractTickersMock.mockReturnValue(["PTON"]);
    extractCashtagTickersMock.mockReturnValue(["CRWD"]);

    const mockResponse = {
      data: [
        {
          id: "1",
          text: "PTON breaking out $CRWD",
          created_at: new Date().toISOString(),
          author_id: "user1",
          public_metrics: { retweet_count: 0, reply_count: 0, like_count: 10, quote_count: 0 },
          entities: { cashtags: [{ tag: "CRWD" }] },
        },
      ],
      includes: {
        users: [
          {
            id: "user1",
            username: "trader1",
            created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
            public_metrics: { followers_count: 500, following_count: 100, tweet_count: 1000 },
          },
        ],
      },
      meta: { result_count: 1 },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const signals = await fetchTwitterSignals();

    // Should have called extractCashtagTickers with the cashtag tags
    expect(extractCashtagTickersMock).toHaveBeenCalledWith(["CRWD"]);

    // Should produce signals for both PTON (regex) and CRWD (cashtag)
    const symbols = signals.map((s) => s.symbol);
    expect(symbols).toContain("PTON");
    expect(symbols).toContain("CRWD");
  });

  it("deduplicates tickers found by both regex and cashtags", async () => {
    extractTickersMock.mockReturnValue(["PTON"]);
    extractCashtagTickersMock.mockReturnValue(["PTON"]); // same ticker from cashtag

    const mockResponse = {
      data: [
        {
          id: "1",
          text: "$PTON breaking out",
          created_at: new Date().toISOString(),
          author_id: "user1",
          public_metrics: { retweet_count: 0, reply_count: 0, like_count: 5, quote_count: 0 },
          entities: { cashtags: [{ tag: "PTON" }] },
        },
      ],
      includes: {
        users: [
          {
            id: "user1",
            username: "trader1",
            created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
            public_metrics: { followers_count: 500, following_count: 100, tweet_count: 1000 },
          },
        ],
      },
      meta: { result_count: 1 },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const signals = await fetchTwitterSignals();
    // Should only produce 1 signal for PTON, not 2
    expect(signals.filter((s) => s.symbol === "PTON")).toHaveLength(1);
  });

  it("works when tweet has no cashtag entities", async () => {
    extractTickersMock.mockReturnValue(["PTON"]);

    const mockResponse = {
      data: [
        {
          id: "1",
          text: "PTON is breaking out",
          created_at: new Date().toISOString(),
          author_id: "user1",
          public_metrics: { retweet_count: 0, reply_count: 0, like_count: 5, quote_count: 0 },
          // No entities
        },
      ],
      includes: {
        users: [
          {
            id: "user1",
            username: "trader1",
            created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
            public_metrics: { followers_count: 500, following_count: 100, tweet_count: 1000 },
          },
        ],
      },
      meta: { result_count: 1 },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const signals = await fetchTwitterSignals();
    expect(extractCashtagTickersMock).not.toHaveBeenCalled();
    expect(signals).toHaveLength(1);
    expect(signals[0].symbol).toBe("PTON");
  });

  it("skips when X_BEARER_TOKEN is not set", async () => {
    delete process.env.X_BEARER_TOKEN;
    const signals = await fetchTwitterSignals();
    expect(signals).toEqual([]);
  });
});
