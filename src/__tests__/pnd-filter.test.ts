import { describe, it, expect } from "vitest";
import { checkPndFlags } from "@/lib/harvester/pnd-filter";
import type { AggregatedSymbol, FundamentalData, RawSignal } from "@/lib/harvester/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAgg(overrides: Partial<AggregatedSymbol> = {}): AggregatedSymbol {
  return {
    symbol: "TEST",
    signals: [],
    sourceCount: 2,
    weightedSourceScore: 2,
    subredditCount: 1,
    totalUpvotes: 100,
    totalComments: 20,
    avgVelocity: 1,
    momentum: {
      risingCount: 0,
      freshCount: 0,
      recentCount: 1,
      commentDerivedCount: 0,
      staleCount: 0,
    },
    medianSignalAgeHrs: null,
    ...overrides,
  };
}

function makeRedditSignal(overrides: Partial<RawSignal> = {}): RawSignal {
  return {
    symbol: "TEST",
    source: "REDDIT",
    title: "TEST looks interesting",
    subreddit: "stocks",
    upvotes: 50,
    postAge: 6,
    ...overrides,
  };
}

function makeFundamentals(overrides: Partial<FundamentalData> = {}): FundamentalData {
  return {
    price: 10,
    marketCap: 500_000_000,
    shortFloat: 0.05,
    exchange: "NASDAQ",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkPndFlags — penny_price", () => {
  it("flags when price is below $0.50 with no catalyst", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: 0.30 }));
    expect(result.flags).toContain("penny_price");
  });

  it("does not flag when price is exactly $0.50", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: 0.50 }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag when price is $0.75 (between $0.50 and $1)", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: 0.75 }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag when price is exactly $1", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: 1.00 }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag when price is above $2", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: 5.00 }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag when price is null", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ price: null }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag penny price when FDA catalyst keyword is present", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "TEST gets FDA approval for new drug" })],
    });
    const result = checkPndFlags(agg, makeFundamentals({ price: 0.30 }));
    expect(result.flags).not.toContain("penny_price");
  });

  it("does not flag penny price when SEC_INSIDER source is present", () => {
    const agg = makeAgg({
      signals: [{ symbol: "TEST", source: "SEC_INSIDER", title: "CEO buys shares" }],
    });
    const result = checkPndFlags(agg, makeFundamentals({ price: 0.30 }));
    expect(result.flags).not.toContain("penny_price");
  });
});

describe("checkPndFlags — otc_listing", () => {
  it("flags OTC exchange", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: "OTC" }));
    expect(result.flags).toContain("otc_listing");
  });

  it("flags Pink Sheets exchange", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: "PinkSheets" }));
    expect(result.flags).toContain("otc_listing");
  });

  it("does not flag NASDAQ", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: "NASDAQ" }));
    expect(result.flags).not.toContain("otc_listing");
  });

  it("does not flag NYSE", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: "NYSE" }));
    expect(result.flags).not.toContain("otc_listing");
  });

  it("does not flag AMEX", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: "AMEX" }));
    expect(result.flags).not.toContain("otc_listing");
  });

  it("does not flag when exchange is not provided", () => {
    const result = checkPndFlags(makeAgg(), makeFundamentals({ exchange: undefined }));
    expect(result.flags).not.toContain("otc_listing");
  });
});

describe("checkPndFlags — micro_cap_no_catalyst", () => {
  it("flags micro cap below $40M with no catalyst keywords", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "Check out TEST stock!" })],
      sourceCount: 1,
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).toContain("micro_cap_no_catalyst");
  });

  it("does not flag $50M cap (above $40M threshold)", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "Check out TEST stock!" })],
      sourceCount: 1,
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 50_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag micro cap if title contains catalyst keyword", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "TEST has an FDA approval catalyst" })],
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag micro cap if SEC_INSIDER source present", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal(),
        { symbol: "TEST", source: "SEC_INSIDER", title: "CEO buys" },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag micro cap if OPTIONS_FLOW source present", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal(),
        { symbol: "TEST", source: "OPTIONS_FLOW", title: "Unusual calls" },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag cap above $40M", () => {
    const agg = makeAgg({ signals: [makeRedditSignal()] });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 100_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag when marketCap is null", () => {
    const agg = makeAgg({ signals: [makeRedditSignal()] });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: null }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("flags body text is also checked for catalyst keywords", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "Check out TEST", body: "earnings beat expectations" })],
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });
});

describe("checkPndFlags — only_penny_subs", () => {
  it("flags when all Reddit signals are from penny-only subreddits", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ subreddit: "pennystocks" }),
        makeRedditSignal({ subreddit: "smallstreetbets" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("only_penny_subs");
  });

  it("does not flag when a reputable subreddit is also present", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ subreddit: "pennystocks" }),
        makeRedditSignal({ subreddit: "wallstreetbets" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("only_penny_subs");
  });

  it("does not flag when no Reddit signals exist", () => {
    const agg = makeAgg({ signals: [] });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("only_penny_subs");
  });

  it("does not flag for r/stocks", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ subreddit: "stocks" })],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("only_penny_subs");
  });
});

describe("checkPndFlags — single_source", () => {
  it("flags when sourceCount is 1 with few signals and low upvotes", () => {
    const result = checkPndFlags(makeAgg({ sourceCount: 1, signals: [], totalUpvotes: 5 }), makeFundamentals());
    expect(result.flags).toContain("single_source");
  });

  it("flags when sourceCount is 0 with few signals and low upvotes", () => {
    const result = checkPndFlags(makeAgg({ sourceCount: 0, signals: [], totalUpvotes: 5 }), makeFundamentals());
    expect(result.flags).toContain("single_source");
  });

  it("does not flag when sourceCount is 2", () => {
    const result = checkPndFlags(makeAgg({ sourceCount: 2 }), makeFundamentals());
    expect(result.flags).not.toContain("single_source");
  });

  it("does not flag single source when signal count exceeds 2", () => {
    const signals = [makeRedditSignal(), makeRedditSignal(), makeRedditSignal()];
    const result = checkPndFlags(makeAgg({ sourceCount: 1, signals, totalUpvotes: 5 }), makeFundamentals());
    expect(result.flags).not.toContain("single_source");
  });

  it("does not flag single source when upvotes are high", () => {
    const result = checkPndFlags(makeAgg({ sourceCount: 1, signals: [], totalUpvotes: 200 }), makeFundamentals());
    expect(result.flags).not.toContain("single_source");
  });
});

describe("checkPndFlags — hyperbolic_language", () => {
  it("flags when 3+ hype phrases appear", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "This will 10x, moon, guaranteed!" }),
        makeRedditSignal({ body: "easy money, trust me, to the moon" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("hyperbolic_language");
  });

  it("does not flag with fewer than 3 hype phrases", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "This might moon and it could 10x" })],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("hyperbolic_language");
  });
});

describe("checkPndFlags — coordinated_posts", () => {
  it("flags when 50%+ of titles are duplicates", () => {
    // 2 identical titles out of 2 → duplicateRatio = 1 - 1/2 = 0.5, meets threshold
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "Buy TEST now before it moons" }),
        makeRedditSignal({ title: "Buy TEST now before it moons" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("coordinated_posts");
  });

  it("does not flag with unique titles", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "Post one" }),
        makeRedditSignal({ title: "Post two" }),
        makeRedditSignal({ title: "Post three" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("coordinated_posts");
  });
});

describe("checkPndFlags — no_news_catalyst", () => {
  it("flags when 5+ signals have no catalyst keywords", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST is amazing" }),
        makeRedditSignal({ title: "Check out TEST!" }),
        makeRedditSignal({ title: "TEST looks good today" }),
        makeRedditSignal({ title: "Anyone watching TEST?" }),
        makeRedditSignal({ title: "TEST is moving up" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("no_news_catalyst");
  });

  it("does not flag with fewer than 5 signals", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST is amazing" }),
        makeRedditSignal({ title: "Check out TEST!" }),
        makeRedditSignal({ title: "TEST looks good today" }),
        makeRedditSignal({ title: "Anyone watching TEST?" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("no_news_catalyst");
  });

  it("does not flag with single signal", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "TEST is amazing" })],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("no_news_catalyst");
  });

  it("does not flag when catalyst keywords present", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST announces merger" }),
        makeRedditSignal({ title: "TEST earnings beat" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("no_news_catalyst");
  });

  it.each([
    ["buyback", "TEST announces $500M buyback program"],
    ["dividend", "TEST declares special dividend"],
    ["spinoff", "TEST announces spinoff of subsidiary"],
    ["spin-off", "TEST completes spin-off"],
    ["restructuring", "TEST announces restructuring plan"],
    ["analyst", "analyst upgrades TEST to buy"],
    ["price target", "price target raised to $50 on TEST"],
    ["beat estimates", "TEST beat estimates by 20%"],
    ["guidance raised", "TEST guidance raised for Q4"],
    ["upgraded", "TEST upgraded by Goldman Sachs"],
    ["downgrade", "TEST hit by downgrade from Morgan Stanley"],
    ["stock split", "TEST announces 10-for-1 stock split"],
    ["offering", "TEST announces public offering"],
    ["catalyst", "Major catalyst for TEST stock"],
    ["breakthrough", "TEST achieves breakthrough in treatment"],
    ["regulatory", "TEST receives regulatory clearance"],
  ])("does not flag when '%s' keyword is present", (_keyword, title) => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title }),
        makeRedditSignal({ title: "Another post about TEST" }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("no_news_catalyst");
  });
});

describe("checkPndFlags — sudden_spike", () => {
  it("flags when 3+ Reddit signals all very recent with low upvotes", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ postAge: 1, upvotes: 2 }),
        makeRedditSignal({ postAge: 2, upvotes: 3 }),
        makeRedditSignal({ postAge: 1, upvotes: 1 }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("sudden_spike");
  });

  it("does not flag when average upvotes are high", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ postAge: 1, upvotes: 100 }),
        makeRedditSignal({ postAge: 2, upvotes: 200 }),
        makeRedditSignal({ postAge: 1, upvotes: 150 }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("sudden_spike");
  });

  it("does not flag when posts are older than 3 hours", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ postAge: 6, upvotes: 2 }),
        makeRedditSignal({ postAge: 8, upvotes: 3 }),
        makeRedditSignal({ postAge: 5, upvotes: 1 }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("sudden_spike");
  });

  it("does not flag with fewer than 3 Reddit signals", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ postAge: 1, upvotes: 2 }),
        makeRedditSignal({ postAge: 2, upvotes: 3 }),
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("sudden_spike");
  });
});

describe("checkPndFlags — twitter_bot_promoters", () => {
  it("flags when 50%+ Twitter signals are bot-like", () => {
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "TWITTER", authorAge: 30, followerCount: 10 },
        { symbol: "TEST", source: "TWITTER", authorAge: 45, followerCount: 5 },
        { symbol: "TEST", source: "TWITTER", authorAge: 400, followerCount: 5000 },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("twitter_bot_promoters");
  });

  it("does not flag when fewer than 2 Twitter signals", () => {
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "TWITTER", authorAge: 30, followerCount: 10 },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("twitter_bot_promoters");
  });

  it("does not flag when bot-like signals are minority", () => {
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "TWITTER", authorAge: 30, followerCount: 10 },
        { symbol: "TEST", source: "TWITTER", authorAge: 400, followerCount: 5000 },
        { symbol: "TEST", source: "TWITTER", authorAge: 365, followerCount: 10000 },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("twitter_bot_promoters");
  });
});

describe("checkPndFlags — twitter_coordinated_pump", () => {
  it("flags when 40%+ tweets share the same first 100 characters", () => {
    const sameBody = "BUY TEST NOW IT WILL MOON THIS IS THE BEST STOCK EVER GUARANTEED TO 10X DON'T MISS OUT!!!!!!!!!!!";
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "TWITTER", body: sameBody },
        { symbol: "TEST", source: "TWITTER", body: sameBody },
        { symbol: "TEST", source: "TWITTER", body: "Different tweet about TEST stock movement today" },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("twitter_coordinated_pump");
  });

  it("does not flag with fewer than 3 Twitter signals", () => {
    const sameBody = "BUY TEST NOW IT WILL MOON THIS IS THE BEST STOCK EVER GUARANTEED TO 10X DON'T MISS OUT!!!!!!!!!!!";
    const agg = makeAgg({
      signals: [
        { symbol: "TEST", source: "TWITTER", body: sameBody },
        { symbol: "TEST", source: "TWITTER", body: sameBody },
      ],
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("twitter_coordinated_pump");
  });
});

describe("checkPndFlags — flagged threshold", () => {
  it("is flagged when 4 or more flags are set", () => {
    // Trigger: penny_price + otc_listing + only_penny_subs + no_news_catalyst (5+ signals)
    const signals = [
      makeRedditSignal({ subreddit: "pennystocks", title: "Buy TEST now" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST is going up" }),
      makeRedditSignal({ subreddit: "smallstreetbets", title: "Check out TEST" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST looking good" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST to the moon" }),
    ];
    const agg = makeAgg({ sourceCount: 1, signals, totalUpvotes: 10 });
    const result = checkPndFlags(
      agg,
      makeFundamentals({ price: 0.30, exchange: "OTC" })
    );
    expect(result.flags.length).toBeGreaterThanOrEqual(4);
    expect(result.flagged).toBe(true);
  });

  it("is not flagged with fewer than 4 flags", () => {
    // Only trigger: penny_price + otc_listing (2 flags — below threshold of 4)
    const agg = makeAgg({ sourceCount: 2, signals: [] });
    const result = checkPndFlags(agg, makeFundamentals({ price: 0.30, exchange: "OTC" }));
    expect(result.flags.length).toBeLessThan(4);
    expect(result.flagged).toBe(false);
  });

  it("returns correct score equal to flag count", () => {
    const signals = [
      makeRedditSignal({ subreddit: "pennystocks", title: "Buy TEST now" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST is going up" }),
      makeRedditSignal({ subreddit: "smallstreetbets", title: "Check out TEST" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST looking good" }),
      makeRedditSignal({ subreddit: "pennystocks", title: "TEST to the moon" }),
    ];
    const agg = makeAgg({ sourceCount: 1, signals, totalUpvotes: 10 });
    const result = checkPndFlags(
      agg,
      makeFundamentals({ price: 0.30, exchange: "OTC" })
    );
    expect(result.score).toBe(result.flags.length);
  });
});

describe("checkPndFlags — micro_cap_no_catalyst bypasses", () => {
  it("does not flag micro cap when upvotes are 500+", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "Check out TEST stock!" })],
      sourceCount: 1,
      totalUpvotes: 600,
      subredditCount: 1,
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });

  it("does not flag micro cap when subredditCount is 3+", () => {
    const agg = makeAgg({
      signals: [makeRedditSignal({ title: "Check out TEST stock!" })],
      sourceCount: 1,
      totalUpvotes: 100,
      subredditCount: 3,
    });
    const result = checkPndFlags(agg, makeFundamentals({ marketCap: 30_000_000 }));
    expect(result.flags).not.toContain("micro_cap_no_catalyst");
  });
});

describe("checkPndFlags — upvote_pump thresholds", () => {
  it("flags when upvotes > 2000 with few posts and very low comments", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST is great", upvotes: 2500 }),
      ],
      totalUpvotes: 2500,
      totalComments: 15,
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).toContain("upvote_pump");
  });

  it("does not flag at 1500 upvotes (below 2000 threshold)", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST is great", upvotes: 1500 }),
      ],
      totalUpvotes: 1500,
      totalComments: 15,
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("upvote_pump");
  });

  it("does not flag when comments >= 30", () => {
    const agg = makeAgg({
      signals: [
        makeRedditSignal({ title: "TEST is great", upvotes: 2500 }),
      ],
      totalUpvotes: 2500,
      totalComments: 35,
    });
    const result = checkPndFlags(agg, makeFundamentals());
    expect(result.flags).not.toContain("upvote_pump");
  });
});

describe("checkPndFlags — null fundamentals", () => {
  it("handles null fundamentals without crashing", () => {
    const agg = makeAgg({ signals: [makeRedditSignal()] });
    expect(() => checkPndFlags(agg, null)).not.toThrow();
  });
});
