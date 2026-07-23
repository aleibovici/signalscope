import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub setTimeout to eliminate sleep delays
const realSetTimeout = globalThis.setTimeout;
vi.stubGlobal("setTimeout", (cb: (...args: unknown[]) => void, _ms?: number, ...args: unknown[]) => {
  return realSetTimeout(cb, 0, ...args);
});

// Mock ticker-utils — return the symbol from the tweet text directly
const extractTickersMock = vi.fn().mockImplementation((text: string) => {
  const match = text.match(/\b([A-Z]{2,5})\b/g) || [];
  // Simple filter for test — just return uppercase words that look like tickers
  return match.filter((t: string) => !["OR", "AND", "THE", "FDA"].includes(t));
});
const extractCashtagTickersMock = vi.fn().mockReturnValue([]);

vi.mock("@/lib/harvester/sources/ticker-utils", () => ({
  extractTickers: (...args: unknown[]) => extractTickersMock(...args),
  extractCashtagTickers: (...args: unknown[]) => extractCashtagTickersMock(...args),
}));

const { fetchTwitterSignals } = await import("@/lib/harvester/sources/twitter");

// ── Helpers ────────────────────────────────────────────────────────────────────

function twitterResponse(
  tweets: Array<{ id: string; text: string; author_id?: string }>,
  nextToken?: string
) {
  return new Response(
    JSON.stringify({
      data: tweets.map((t) => ({
        id: t.id,
        text: t.text,
        created_at: new Date().toISOString(),
        author_id: t.author_id ?? "user1",
        public_metrics: { retweet_count: 5, reply_count: 2, like_count: 10, quote_count: 1 },
      })),
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
      meta: {
        result_count: tweets.length,
        ...(nextToken ? { next_token: nextToken } : {}),
      },
    }),
    { status: 200 }
  );
}

function rateLimitResponse() {
  return new Response("Too Many Requests", { status: 429 });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv, X_BEARER_TOKEN: "test-token", X_MAX_PAGES: "3" };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

// ── Pagination ─────────────────────────────────────────────────────────────────

describe("fetchTwitterSignals — pagination", () => {
  it("paginates using next_token across multiple pages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        twitterResponse([{ id: "1", text: "PLTR breaking out" }], "token_page2")
      )
      .mockResolvedValueOnce(
        twitterResponse([{ id: "2", text: "SOFI squeeze incoming" }]) // no next_token
      );

    const signals = await fetchTwitterSignals();

    // 2 fetch calls (page 1 + page 2)
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Page 2 URL should include next_token
    const page2Url = fetchSpy.mock.calls[1][0] as string;
    expect(page2Url).toContain("next_token=token_page2");

    // Signals from both pages
    const symbols = signals.map((s) => s.symbol);
    expect(symbols).toContain("PLTR");
    expect(symbols).toContain("SOFI");
  });

  it("stops when there is no next_token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        twitterResponse([{ id: "1", text: "PLTR move" }]) // no next_token
      );

    await fetchTwitterSignals();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops at X_MAX_PAGES even if next_token is present", async () => {
    process.env.X_MAX_PAGES = "2";

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        twitterResponse([{ id: "1", text: "PLTR page1" }], "token2")
      )
      .mockResolvedValueOnce(
        twitterResponse([{ id: "2", text: "SOFI page2" }], "token3") // has next_token but max pages reached
      )
      .mockResolvedValueOnce(
        twitterResponse([{ id: "3", text: "MARA page3" }])
      );

    const signals = await fetchTwitterSignals();

    // Only 2 pages fetched (X_MAX_PAGES=2)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const symbols = signals.map((s) => s.symbol);
    expect(symbols).toContain("PLTR");
    expect(symbols).toContain("SOFI");
    expect(symbols).not.toContain("MARA");
  });

  it("returns partial results when rate limited mid-pagination", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        twitterResponse([{ id: "1", text: "PLTR breaking out" }], "token2")
      )
      .mockResolvedValueOnce(rateLimitResponse());

    const signals = await fetchTwitterSignals();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Page 1 signals preserved despite page 2 rate limit
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].symbol).toBe("PLTR");
  });

  it("accumulates users across pages", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "1",
                text: "PLTR breaking out",
                created_at: new Date().toISOString(),
                author_id: "userA",
                public_metrics: { retweet_count: 0, reply_count: 0, like_count: 5, quote_count: 0 },
              },
            ],
            includes: {
              users: [
                {
                  id: "userA",
                  username: "traderA",
                  created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
                  public_metrics: { followers_count: 1000, following_count: 50, tweet_count: 500 },
                },
              ],
            },
            meta: { result_count: 1, next_token: "page2" },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "2",
                text: "SOFI squeeze",
                created_at: new Date().toISOString(),
                author_id: "userB",
                public_metrics: { retweet_count: 0, reply_count: 0, like_count: 3, quote_count: 0 },
              },
            ],
            includes: {
              users: [
                {
                  id: "userB",
                  username: "traderB",
                  created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
                  public_metrics: { followers_count: 200, following_count: 300, tweet_count: 100 },
                },
              ],
            },
            meta: { result_count: 1 },
          }),
          { status: 200 }
        )
      );

    const signals = await fetchTwitterSignals();

    const pltrSignal = signals.find((s) => s.symbol === "PLTR");
    const sofiSignal = signals.find((s) => s.symbol === "SOFI");
    expect(pltrSignal?.author).toBe("traderA");
    expect(pltrSignal?.followerCount).toBe(1000);
    expect(sofiSignal?.author).toBe("traderB");
    expect(sofiSignal?.followerCount).toBe(200);
  });
});

// ── Retweet filter ─────────────────────────────────────────────────────────────

describe("fetchTwitterSignals — retweet filter", () => {
  it("includes -is:retweet in the query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(twitterResponse([]));

    await fetchTwitterSignals();

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("-is%3Aretweet"); // URL-encoded -is:retweet
  });
});

// ── X_MAX_PAGES defaults ───────────────────────────────────────────────────────

describe("fetchTwitterSignals — X_MAX_PAGES config", () => {
  it("defaults to 3 pages when X_MAX_PAGES is not set", async () => {
    delete process.env.X_MAX_PAGES;

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(twitterResponse([{ id: "1", text: "PLTR p1" }], "t2"))
      .mockResolvedValueOnce(twitterResponse([{ id: "2", text: "SOFI p2" }], "t3"))
      .mockResolvedValueOnce(twitterResponse([{ id: "3", text: "MARA p3" }], "t4"))
      .mockResolvedValueOnce(twitterResponse([{ id: "4", text: "HOOD p4" }]));

    await fetchTwitterSignals();
    expect(fetchSpy).toHaveBeenCalledTimes(3); // default 3, not 4
  });

  it("caps at 5 pages even if X_MAX_PAGES is higher", async () => {
    process.env.X_MAX_PAGES = "10";

    const mocks = Array.from({ length: 6 }, (_, i) =>
      twitterResponse([{ id: String(i + 1), text: `PLTR page${i + 1}` }], `token${i + 2}`)
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const mock of mocks) fetchSpy.mockResolvedValueOnce(mock);

    await fetchTwitterSignals();
    expect(fetchSpy).toHaveBeenCalledTimes(5); // capped at 5
  });
});
