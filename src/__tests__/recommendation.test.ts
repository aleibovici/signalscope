import { describe, expect, it } from "vitest";
import { TickerStage } from "@/generated/prisma/client";
import {
  buildRecommendationInput,
  deriveRecommendation,
  hasHardCatalyst,
  RECOMMENDATION_RULE_PATHS,
  recommendationHasTradeSetup,
  RECOMMENDATION_RULE_VERSION,
  type Recommendation,
  type RecommendationInput,
} from "@/lib/harvester/recommendation";
import type { AggregatedSymbol } from "@/lib/harvester/types";

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    aiScore: 50,
    stage: "FORMING",
    sourceCount: 2,
    hasCatalystSource: false,
    pndFlagged: false,
    price: 5,
    marketCap: 500_000_000,
    medianSignalAgeHrs: 4,
    ...overrides,
  };
}

/** Golden matrix — one assertion per locked v3 path and key negative case. */
describe("deriveRecommendation — v3 decision matrix", () => {
  const cases: [string, Partial<RecommendationInput>, Recommendation][] = [
    ["Strong Buy: FORMING + catalyst + src2 + score 62", { stage: "FORMING", hasCatalystSource: true, sourceCount: 2, aiScore: 62 }, "Strong Buy"],
    ["Buy A: EARLY + catalyst + src2 + score 57", { stage: "EARLY", hasCatalystSource: true, sourceCount: 2, aiScore: 57 }, "Buy"],
    ["Buy B: FORMING social momentum", { stage: "FORMING", hasCatalystSource: false, sourceCount: 2, aiScore: 62 }, "Buy"],
    ["Buy C: CONFIRMED fresh", { stage: "CONFIRMED", aiScore: 62, medianSignalAgeHrs: 2 }, "Buy"],
    [
      "Watch: mega-cap FORMING catalyst",
      { stage: "FORMING", hasCatalystSource: true, sourceCount: 2, aiScore: 80, marketCap: 2_000_000_000_000 },
      "Watch",
    ],
    [
      "Watch: mega-cap CONFIRMED fresh",
      { stage: "CONFIRMED", aiScore: 80, medianSignalAgeHrs: 2, marketCap: 2_000_000_000_000 },
      "Watch",
    ],
    [
      "Strong Buy: large-cap ($500B) FORMING catalyst score>=60 — not mega-cap",
      { stage: "FORMING", hasCatalystSource: true, sourceCount: 2, aiScore: 65, marketCap: 500_000_000_000 },
      "Strong Buy",
    ],
    [
      "Buy C: large-cap ($800B) CONFIRMED fresh score>=60 — not mega-cap",
      { stage: "CONFIRMED", aiScore: 65, medianSignalAgeHrs: 2, marketCap: 800_000_000_000 },
      "Buy",
    ],
    ["Watch: CONFIRMED stale", { stage: "CONFIRMED", aiScore: 80, medianSignalAgeHrs: 10 }, "Watch"],
    ["Watch: EARLY high score social-only", { stage: "EARLY", hasCatalystSource: false, sourceCount: 1, aiScore: 90 }, "Watch"],
    ["Avoid: pndFlagged", { pndFlagged: true, stage: "FORMING", hasCatalystSource: true, sourceCount: 3, aiScore: 90 }, "Avoid"],
    ["Avoid: penny stock", { price: 0.08, stage: "FORMING", hasCatalystSource: true, aiScore: 80 }, "Avoid"],
  ];

  it.each(cases)("%s → %s", (_label, overrides, expected) => {
    expect(deriveRecommendation(input(overrides))).toBe(expected);
  });
});

describe("deriveRecommendation — score and path boundaries", () => {
  it("returns Buy (not Strong Buy) at score 59 with catalyst (Buy A)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 59,
        }),
      ),
    ).toBe("Buy");
  });

  it("returns Watch below Buy A score threshold", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 54,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for single-source catalyst (no corroboration)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 1,
          aiScore: 70,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for FORMING social-only below score 60", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: false,
          sourceCount: 2,
          aiScore: 59,
        }),
      ),
    ).toBe("Watch");
  });

  it("does not promote EARLY via Buy B social path", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: false,
          sourceCount: 3,
          aiScore: 70,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for CONFIRMED below score 60 even when fresh", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          aiScore: 59,
          medianSignalAgeHrs: 1,
        }),
      ),
    ).toBe("Watch");
  });

  it("treats null medianSignalAgeHrs as fresh for Buy C", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          aiScore: 65,
          medianSignalAgeHrs: null,
        }),
      ),
    ).toBe("Buy");
  });

  it("returns Watch (not Avoid) for very low score with no catalyst", () => {
    expect(deriveRecommendation(input({ aiScore: 15, hasCatalystSource: false }))).toBe("Watch");
  });

  it("returns Avoid for FILTERED stage", () => {
    expect(deriveRecommendation(input({ stage: "FILTERED" }))).toBe("Avoid");
  });

  it("is deterministic", () => {
    const i = input({
      stage: "FORMING",
      hasCatalystSource: true,
      sourceCount: 2,
      aiScore: 65,
    });
    expect(deriveRecommendation(i)).toBe(deriveRecommendation(i));
  });
});

describe("RECOMMENDATION_RULE_PATHS", () => {
  it("each path match agrees with deriveRecommendation for a crafted hit", () => {
    const hits: [string, RecommendationInput][] = [
      ["avoid_filtered", input({ stage: "FILTERED" })],
      ["avoid_pnd", input({ pndFlagged: true })],
      ["avoid_penny", input({ price: 0.08 })],
      [
        "strong_buy",
        input({ stage: "FORMING", hasCatalystSource: true, sourceCount: 2, aiScore: 62 }),
      ],
      [
        "buy_a",
        input({ stage: "EARLY", hasCatalystSource: true, sourceCount: 2, aiScore: 57 }),
      ],
      [
        "buy_b",
        input({ stage: "FORMING", hasCatalystSource: false, sourceCount: 2, aiScore: 62 }),
      ],
      ["buy_c", input({ stage: "CONFIRMED", aiScore: 62, medianSignalAgeHrs: 2 })],
    ];

    for (const [id, ctx] of hits) {
      const rule = RECOMMENDATION_RULE_PATHS.find((r) => r.id === id);
      expect(rule, id).toBeDefined();
      expect(rule!.match(ctx)).toBe(true);
      expect(deriveRecommendation(ctx)).toBe(rule!.recommendation);
    }
  });
});

describe("recommendationHasTradeSetup", () => {
  it("returns true for Buy and Strong Buy", () => {
    expect(recommendationHasTradeSetup("Buy")).toBe(true);
    expect(recommendationHasTradeSetup("Strong Buy")).toBe(true);
  });

  it("returns false for Watch and Avoid", () => {
    expect(recommendationHasTradeSetup("Watch")).toBe(false);
    expect(recommendationHasTradeSetup("Avoid")).toBe(false);
  });
});

describe("RECOMMENDATION_RULE_VERSION", () => {
  it("is 4 after raising the cap to $1T (restoring large-cap catalyst signals)", () => {
    expect(RECOMMENDATION_RULE_VERSION).toBe(4);
  });
});

describe("hasHardCatalyst", () => {
  it("returns true for insider, options, and congress", () => {
    expect(hasHardCatalyst(["SEC_INSIDER"])).toBe(true);
    expect(hasHardCatalyst(["OPTIONS_FLOW"])).toBe(true);
    expect(hasHardCatalyst(["CONGRESS"])).toBe(true);
  });

  it("returns false for volume spike, SEC filing, and social-only sources", () => {
    expect(hasHardCatalyst(["VOLUME_SPIKE", "REDDIT"])).toBe(false);
    expect(hasHardCatalyst(["SEC_FILING"])).toBe(false);
    expect(hasHardCatalyst(["REDDIT", "STOCKTWITS"])).toBe(false);
  });
});

describe("buildRecommendationInput", () => {
  const baseAgg = (): AggregatedSymbol => ({
    symbol: "TEST",
    signals: [
      { symbol: "TEST", source: "REDDIT", title: "Chatter" },
      { symbol: "TEST", source: "VOLUME_SPIKE", title: "2x volume" },
    ],
    sourceCount: 2,
    weightedSourceScore: 2,
    subredditCount: 1,
    totalUpvotes: 50,
    totalComments: 5,
    avgVelocity: 2,
    momentum: { risingCount: 1, freshCount: 1, recentCount: 0, commentDerivedCount: 0, staleCount: 0 },
    medianSignalAgeHrs: 2,
  });

  it("does not treat volume spike as a hard catalyst", () => {
    const recInput = buildRecommendationInput(baseAgg(), null, 65, TickerStage.FORMING, false);
    expect(recInput.hasCatalystSource).toBe(false);
  });

  it("matches deriveRecommendation when passed through", () => {
    const recInput = buildRecommendationInput(baseAgg(), null, 65, TickerStage.FORMING, false);
    expect(deriveRecommendation(recInput)).toBe("Buy");
    expect(deriveRecommendation(recInput)).not.toBe("Strong Buy");
  });
});
