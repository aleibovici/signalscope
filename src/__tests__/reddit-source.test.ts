import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub setTimeout to eliminate sleep delays (resolve on next tick instead)
const realSetTimeout = globalThis.setTimeout;
vi.stubGlobal("setTimeout", (cb: (...args: unknown[]) => void, _ms?: number, ...args: unknown[]) => {
  return realSetTimeout(cb, 0, ...args);
});

// Track fetch calls for assertions
let fetchCalls: string[] = [];
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubs are in place
const { fetchRedditSignals } = await import("@/lib/harvester/sources/reddit");

// ── Helpers ────────────────────────────────────────────────────────────────────

function redditListing(
  posts: Array<{
    title: string;
    permalink: string;
    selftext?: string;
    num_comments?: number;
    subreddit?: string;
    link_flair_text?: string;
  }>,
  after: string | null = null
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        children: posts.map((p) => ({
          data: {
            title: p.title,
            selftext: p.selftext ?? "",
            author: "testuser",
            ups: 50,
            num_comments: p.num_comments ?? 5,
            permalink: p.permalink,
            subreddit: p.subreddit ?? "wallstreetbets",
            created_utc: Date.now() / 1000 - 3600, // 1 hour ago
            link_flair_text: p.link_flair_text ?? null,
          },
        })),
        after,
      },
    }),
  };
}

function commentJson(comments: Array<{ body: string; author?: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => [
      { data: { children: [] } },
      {
        data: {
          children: comments.map((c) => ({
            kind: "t1",
            data: { body: c.body, author: c.author ?? "commenter" },
          })),
        },
      },
    ],
  };
}

const emptyListing = () => redditListing([]);

function urlStr(url: string | URL | Request): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  return url.url;
}

beforeEach(() => {
  fetchCalls = [];
  mockFetch.mockReset();
  // Default: all URLs return empty listing
  mockFetch.mockImplementation(async (url: string | URL | Request) => {
    fetchCalls.push(urlStr(url));
    return emptyListing();
  });
});

// ── Pagination ─────────────────────────────────────────────────────────────────

describe("fetchRedditSignals — pagination", () => {
  it("fetches multiple pages for WSB new using after token", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      // WSB new page 1 (no after param) — use non-mega-cap tickers (MEGA_CAPS filters AAPL/TSLA/NVDA)
      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing(
          [{ title: "PLTR breaking out", selftext: "Long PLTR", permalink: "/r/wallstreetbets/comments/p1/pltr/" }],
          "t3_page1"
        );
      }
      // WSB new page 2
      if (u.includes("/wallstreetbets/new.json") && u.includes("after=t3_page1")) {
        return redditListing(
          [{ title: "SOFI squeeze", selftext: "Buy SOFI", permalink: "/r/wallstreetbets/comments/p2/sofi/" }],
          "t3_page2"
        );
      }
      // WSB new page 3
      if (u.includes("/wallstreetbets/new.json") && u.includes("after=t3_page2")) {
        return redditListing(
          [{ title: "MARA earnings beat", selftext: "MARA mooning", permalink: "/r/wallstreetbets/comments/p3/mara/" }],
          null
        );
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();

    // All 3 pages fetched with correct after tokens
    const wsbNewCalls = fetchCalls.filter((u) => u.includes("/wallstreetbets/new.json"));
    expect(wsbNewCalls.length).toBe(3);
    expect(wsbNewCalls[0]).not.toContain("after=");
    expect(wsbNewCalls[1]).toContain("after=t3_page1");
    expect(wsbNewCalls[2]).toContain("after=t3_page2");

    // Signals from all 3 pages present
    const symbols = new Set(signals.map((s) => s.symbol));
    expect(symbols.has("PLTR")).toBe(true);
    expect(symbols.has("SOFI")).toBe(true);
    expect(symbols.has("MARA")).toBe(true);
  });

  it("stops pagination early when after token is null", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      // WSB new page 1 — no after token (config says 3 pages, but only 1 available)
      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing(
          [{ title: "PLTR move", selftext: "PLTR up", permalink: "/r/wallstreetbets/comments/p1/pltr/" }],
          null
        );
      }

      return emptyListing();
    });

    await fetchRedditSignals();

    const wsbNewCalls = fetchCalls.filter((u) => u.includes("/wallstreetbets/new.json"));
    expect(wsbNewCalls.length).toBe(1);
  });

  it("does not paginate rising or hot sorts", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      // WSB rising/hot return posts with an after token — pagination should NOT follow it
      if (u.includes("/wallstreetbets/rising.json") || u.includes("/wallstreetbets/hot.json")) {
        return redditListing(
          [{ title: "PLTR trending", selftext: "PLTR up", permalink: "/r/wallstreetbets/comments/r1/pltr/" }],
          "t3_shouldnotfollow"
        );
      }

      return emptyListing();
    });

    await fetchRedditSignals();

    // Rising and hot should each have exactly 1 call (no pagination)
    const risingCalls = fetchCalls.filter((u) => u.includes("/wallstreetbets/rising.json"));
    const hotCalls = fetchCalls.filter((u) => u.includes("/wallstreetbets/hot.json"));
    expect(risingCalls.length).toBe(1);
    expect(hotCalls.length).toBe(1);
    expect(fetchCalls.filter((u) => u.includes("after=t3_shouldnotfollow")).length).toBe(0);
  });
});

// ── Comment dedup ──────────────────────────────────────────────────────────────

describe("fetchRedditSignals — comment dedup across sorts", () => {
  it("fetches comments only once for the same permalink across new, rising, and hot", async () => {
    const sharedPermalink = "/r/wallstreetbets/comments/shared123/test_post/";
    const sharedPost = {
      title: "PLTR breaking out",
      selftext: "PLTR is moving",
      permalink: sharedPermalink,
      num_comments: 30, // above threshold (25)
    };

    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      // Same high-engagement post appears in all 3 WSB sorts
      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing([sharedPost]);
      }
      if (u.includes("/wallstreetbets/rising.json")) {
        return redditListing([sharedPost]);
      }
      if (u.includes("/wallstreetbets/hot.json")) {
        return redditListing([sharedPost]);
      }

      // Comment endpoint for the shared permalink
      if (u.includes(sharedPermalink) && u.includes("depth=1")) {
        return commentJson([{ body: "Also look at SOFI", author: "analyst1" }]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();

    // Comment endpoint called exactly once despite post appearing in 3 sorts
    const commentCalls = fetchCalls.filter((u) => u.includes(sharedPermalink) && u.includes("depth=1"));
    expect(commentCalls.length).toBe(1);

    // The comment-derived SOFI signal exists
    const sofiCommentSignals = signals.filter((s) => s.symbol === "SOFI" && s.sortType === "comment");
    expect(sofiCommentSignals.length).toBe(1);

    // Post-level PLTR signals still exist for all 3 sorts (dedup is comment-only)
    const pltrSignals = signals.filter((s) => s.symbol === "PLTR" && s.sortType !== "comment");
    expect(pltrSignals.length).toBe(3); // new + rising + hot
  });

  it("deduplicates comments across different subreddits too", async () => {
    const sharedPermalink = "/r/stocks/comments/cross123/crosspost/";
    const crossPost = {
      title: "HOOD earnings crush",
      selftext: "HOOD beat estimates",
      permalink: sharedPermalink,
      num_comments: 40,
      subreddit: "stocks",
    };

    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      // Same post in stocks/new and stocks/rising
      if (u.includes("/stocks/new.json") && !u.includes("after=")) {
        return redditListing([crossPost]);
      }
      if (u.includes("/stocks/rising.json")) {
        return redditListing([crossPost]);
      }
      if (u.includes("/stocks/hot.json")) {
        return redditListing([crossPost]);
      }

      // Comment endpoint
      if (u.includes(sharedPermalink) && u.includes("depth=1")) {
        return commentJson([{ body: "MARA too", author: "user2" }]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();

    const commentCalls = fetchCalls.filter((u) => u.includes(sharedPermalink) && u.includes("depth=1"));
    expect(commentCalls.length).toBe(1);

    const maraSignals = signals.filter((s) => s.symbol === "MARA" && s.sortType === "comment");
    expect(maraSignals.length).toBe(1);
  });
});

// ── Flair extraction ───────────────────────────────────────────────────────────

describe("fetchRedditSignals — flair extraction", () => {
  it("passes flair through to signals", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing([
          {
            title: "PLTR deep dive",
            selftext: "PLTR analysis",
            permalink: "/r/wallstreetbets/comments/f1/pltr/",
            link_flair_text: "DD",
          },
        ]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();
    const pltrSignals = signals.filter((s) => s.symbol === "PLTR");
    expect(pltrSignals.length).toBeGreaterThan(0);
    expect(pltrSignals[0].flair).toBe("DD");
  });

  it("sets flair to undefined when link_flair_text is null", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing([
          {
            title: "SOFI moving",
            selftext: "SOFI up",
            permalink: "/r/wallstreetbets/comments/f2/sofi/",
            link_flair_text: undefined,
          },
        ]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();
    const sofiSignals = signals.filter((s) => s.symbol === "SOFI");
    expect(sofiSignals.length).toBeGreaterThan(0);
    expect(sofiSignals[0].flair).toBeUndefined();
  });

  it("inherits parent post flair on comment-derived signals", async () => {
    const permalink = "/r/wallstreetbets/comments/fc1/flair_comment/";

    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      if (u.includes("/wallstreetbets/new.json") && !u.includes("after=")) {
        return redditListing([
          {
            title: "PLTR analysis",
            selftext: "Deep dive on PLTR",
            permalink,
            num_comments: 30,
            link_flair_text: "Due Diligence",
          },
        ]);
      }

      if (u.includes(permalink) && u.includes("depth=1")) {
        return commentJson([{ body: "Also bullish on SOFI" }]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();
    const sofiCommentSignals = signals.filter((s) => s.symbol === "SOFI" && s.sortType === "comment");
    expect(sofiCommentSignals.length).toBe(1);
    expect(sofiCommentSignals[0].flair).toBe("Due Diligence");
  });
});

// ── Hot sort ───────────────────────────────────────────────────────────────────

describe("fetchRedditSignals — hot sort", () => {
  it("fetches hot sort for WSB, stocks, and pennystocks", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);
      return emptyListing();
    });

    await fetchRedditSignals();

    // hot sort should be fetched for the 3 configured subs
    const hotCalls = fetchCalls.filter((u) => u.includes("/hot.json"));
    const hotSubs = hotCalls.map((u) => {
      const match = u.match(/\/r\/([^/]+)\/hot\.json/);
      return match?.[1];
    });
    expect(hotSubs).toContain("wallstreetbets");
    expect(hotSubs).toContain("stocks");
    expect(hotSubs).toContain("pennystocks");
    expect(hotSubs.length).toBe(3);
  });

  it("tags hot signals with sortType hot", async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = urlStr(url);
      fetchCalls.push(u);

      if (u.includes("/wallstreetbets/hot.json")) {
        return redditListing([
          { title: "PLTR on fire", selftext: "PLTR trending", permalink: "/r/wallstreetbets/comments/h1/pltr/" },
        ]);
      }

      return emptyListing();
    });

    const signals = await fetchRedditSignals();
    const hotSignals = signals.filter((s) => s.sortType === "hot");
    expect(hotSignals.length).toBeGreaterThan(0);
    expect(hotSignals[0].symbol).toBe("PLTR");
  });
});
