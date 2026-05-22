import { describe, expect, it } from "vitest";
import {
  deriveRecommendation,
  recommendationHasTradeSetup,
  RECOMMENDATION_RULE_VERSION,
  type Recommendation,
  type RecommendationInput,
} from "@/lib/harvester/recommendation";

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    aiScore: 50,
    stage: "FORMING",
    sourceCount: 2,
    hasCatalystSource: false,
    pndFlagged: false,
    price: 5,
    medianSignalAgeHrs: 4,
    ...overrides,
  };
}

describe("deriveRecommendation — hard Avoid", () => {
  it("returns Avoid for FILTERED stage", () => {
    expect(deriveRecommendation(input({ stage: "FILTERED" }))).toBe("Avoid");
  });

  it("returns Avoid when pndFlagged regardless of stage / score / catalyst", () => {
    expect(
      deriveRecommendation(
        input({
          pndFlagged: true,
          aiScore: 90,
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 4,
        }),
      ),
    ).toBe("Avoid");
  });

  it("returns Avoid for sub-$0.12 stocks even with strong signal", () => {
    expect(
      deriveRecommendation(
        input({ price: 0.1, aiScore: 80, hasCatalystSource: true, sourceCount: 3 }),
      ),
    ).toBe("Avoid");
  });

  it("returns Watch (not Avoid) for very low score with no catalyst", () => {
    // Calibration: score<20+no_catalyst ≈ baseline. Don't overstate confidence
    // by labeling these Avoid.
    expect(
      deriveRecommendation(input({ aiScore: 15, hasCatalystSource: false })),
    ).toBe("Watch");
  });
});

describe("deriveRecommendation — Strong Buy (FORMING only)", () => {
  it("returns Strong Buy for FORMING + catalyst + 2+ sources + score>=60", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 62,
        }),
      ),
    ).toBe("Strong Buy");
  });

  it("returns Strong Buy at the score=60 boundary", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 60,
        }),
      ),
    ).toBe("Strong Buy");
  });

  it("does NOT return Strong Buy below the score=60 threshold (falls through to Buy A)", () => {
    // FORMING+catalyst+src=2+score=59 is below Strong Buy's 60 bar but clears
    // Buy Path A (catalyst-led, score>=55).
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

  it("does NOT return Strong Buy without a catalyst source", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: false,
          sourceCount: 4,
          aiScore: 80,
        }),
      ),
    ).not.toBe("Strong Buy");
  });

  it("does NOT return Strong Buy from EARLY stage even with strongest signal", () => {
    // EARLY+catalyst+score>=70 yielded mean7d=-0.23% in calibration — actively
    // below baseline. EARLY is structurally locked out of Strong Buy.
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 90,
        }),
      ),
    ).not.toBe("Strong Buy");
  });

  it("does NOT return Strong Buy from CONFIRMED stage (consensus = already moved)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          hasCatalystSource: true,
          sourceCount: 4,
          aiScore: 85,
          medianSignalAgeHrs: 2,
        }),
      ),
    ).not.toBe("Strong Buy");
  });
});

describe("deriveRecommendation — Buy Path A (catalyst-led EARLY/FORMING)", () => {
  it("returns Buy for FORMING + catalyst + 2 sources + score>=55", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 57,
        }),
      ),
    ).toBe("Buy");
  });

  it("returns Buy for EARLY + catalyst + 2 sources + score>=55 (rare path)", () => {
    // EARLY+catalyst+src>=2 had n=0 in calibration (multi-source promotes to
    // FORMING). Rule allows it for forward-compatibility if signal-aggregation
    // logic ever evolves.
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: true,
          sourceCount: 2,
          aiScore: 60,
        }),
      ),
    ).toBe("Buy");
  });

  it("does NOT return Buy when score < 55", () => {
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

  it("does NOT return Buy when sourceCount = 1 even with catalyst", () => {
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
});

describe("deriveRecommendation — Buy Path B (FORMING + multi-source social momentum)", () => {
  it("returns Buy for FORMING + 2 sources + score>=60 (no catalyst required)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "FORMING",
          hasCatalystSource: false,
          sourceCount: 2,
          aiScore: 62,
        }),
      ),
    ).toBe("Buy");
  });

  it("does NOT return Buy when FORMING + score < 60 (no catalyst)", () => {
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

  it("does NOT promote EARLY to Buy via the FORMING-only social path", () => {
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
});

describe("deriveRecommendation — Buy Path C (CONFIRMED soft-demotion + freshness)", () => {
  it("returns Buy for CONFIRMED + score>=60 with fresh signals", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          aiScore: 65,
          medianSignalAgeHrs: 3,
        }),
      ),
    ).toBe("Buy");
  });

  it("returns Watch (not Buy) for CONFIRMED with stale signals (>6h)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          aiScore: 70,
          medianSignalAgeHrs: 12,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for CONFIRMED + score<60 even when fresh", () => {
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

  it("treats null medianSignalAgeHrs (non-social signals) as fresh", () => {
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
});

describe("deriveRecommendation — EARLY defaults to Watch", () => {
  it("returns Watch for EARLY social-only signals", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: false,
          sourceCount: 1,
          aiScore: 35,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for high-AI-score EARLY (calibration: actively below baseline)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: false,
          sourceCount: 1,
          aiScore: 85,
        }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for EARLY + single-source catalyst (no corroboration)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "EARLY",
          hasCatalystSource: true,
          sourceCount: 1,
          aiScore: 75,
        }),
      ),
    ).toBe("Watch");
  });
});

describe("deriveRecommendation — determinism", () => {
  it("same input always produces same output", () => {
    const i = input({
      stage: "FORMING",
      hasCatalystSource: true,
      sourceCount: 2,
      aiScore: 65,
    });
    expect(deriveRecommendation(i)).toBe(deriveRecommendation(i));
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
  it("is 2 after the emerging-focused rule change", () => {
    expect(RECOMMENDATION_RULE_VERSION).toBe(2);
  });
});

/** Golden matrix — one assertion per locked v2 path and key negative case. */
describe("deriveRecommendation — v2 decision matrix", () => {
  const cases: [string, Partial<RecommendationInput>, Recommendation][] = [
    ["Strong Buy: FORMING + catalyst + src2 + score 62", { stage: "FORMING", hasCatalystSource: true, sourceCount: 2, aiScore: 62 }, "Strong Buy"],
    ["Buy A: EARLY + catalyst + src2 + score 57", { stage: "EARLY", hasCatalystSource: true, sourceCount: 2, aiScore: 57 }, "Buy"],
    ["Buy B: FORMING social momentum", { stage: "FORMING", hasCatalystSource: false, sourceCount: 2, aiScore: 62 }, "Buy"],
    ["Buy C: CONFIRMED fresh", { stage: "CONFIRMED", aiScore: 62, medianSignalAgeHrs: 2 }, "Buy"],
    ["Watch: CONFIRMED stale", { stage: "CONFIRMED", aiScore: 80, medianSignalAgeHrs: 10 }, "Watch"],
    ["Watch: EARLY high score social-only", { stage: "EARLY", hasCatalystSource: false, sourceCount: 1, aiScore: 90 }, "Watch"],
    ["Avoid: pndFlagged", { pndFlagged: true, stage: "FORMING", hasCatalystSource: true, sourceCount: 3, aiScore: 90 }, "Avoid"],
    ["Avoid: penny stock", { price: 0.08, stage: "FORMING", hasCatalystSource: true, aiScore: 80 }, "Avoid"],
  ];

  it.each(cases)("%s → %s", (_label, overrides, expected) => {
    expect(deriveRecommendation(input(overrides))).toBe(expected);
  });
});
