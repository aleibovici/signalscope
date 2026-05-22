import { describe, expect, it } from "vitest";
import {
  deriveRecommendation,
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

describe("deriveRecommendation", () => {
  it("returns Avoid when P&D flagged", () => {
    expect(
      deriveRecommendation(input({ pndFlagged: true, aiScore: 90, stage: "CONFIRMED" })),
    ).toBe("Avoid");
  });

  it("returns Avoid for sub-$0.12 stocks", () => {
    expect(
      deriveRecommendation(input({ price: 0.1, aiScore: 80, hasCatalystSource: true })),
    ).toBe("Avoid");
  });

  it("returns Avoid for very low score with no catalyst", () => {
    expect(deriveRecommendation(input({ aiScore: 15, hasCatalystSource: false }))).toBe("Avoid");
  });

  it("does NOT return Avoid for low score when catalyst exists", () => {
    expect(
      deriveRecommendation(input({ aiScore: 15, hasCatalystSource: true, sourceCount: 1 })),
    ).not.toBe("Avoid");
  });

  it("returns Avoid for FILTERED stage", () => {
    expect(deriveRecommendation(input({ stage: "FILTERED" }))).toBe("Avoid");
  });

  it("returns Strong Buy: CONFIRMED + catalyst + 3 sources + score>=70 + fresh signals", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          hasCatalystSource: true,
          sourceCount: 3,
          aiScore: 72,
          medianSignalAgeHrs: 4,
        }),
      ),
    ).toBe("Strong Buy");
  });

  it("does NOT return Strong Buy when signals are stale (>6h)", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          hasCatalystSource: true,
          sourceCount: 3,
          aiScore: 72,
          medianSignalAgeHrs: 10,
        }),
      ),
    ).not.toBe("Strong Buy");
  });

  it("treats null medianSignalAgeHrs (non-social signals) as fresh", () => {
    expect(
      deriveRecommendation(
        input({
          stage: "CONFIRMED",
          hasCatalystSource: true,
          sourceCount: 3,
          aiScore: 72,
          medianSignalAgeHrs: null,
        }),
      ),
    ).toBe("Strong Buy");
  });

  it("returns Buy for CONFIRMED + score>=60", () => {
    expect(deriveRecommendation(input({ stage: "CONFIRMED", aiScore: 62 }))).toBe("Buy");
  });

  it("returns Buy for catalyst-led + 2 sources + score>=55", () => {
    expect(
      deriveRecommendation(
        input({ hasCatalystSource: true, sourceCount: 2, aiScore: 57, stage: "EARLY" }),
      ),
    ).toBe("Buy");
  });

  it("returns Watch for FORMING + multi-source without catalyst (calibration confirmed insufficient)", () => {
    // FORMING + src>=2 + score>=60 had mean7d=+1.52% — below the +2% Buy bar.
    // This case must NOT promote to Buy.
    expect(
      deriveRecommendation(
        input({ stage: "FORMING", sourceCount: 2, aiScore: 65, hasCatalystSource: false }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for EARLY social-only signals", () => {
    expect(
      deriveRecommendation(
        input({ stage: "EARLY", hasCatalystSource: false, sourceCount: 1, aiScore: 35 }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for CONFIRMED with score just below 60", () => {
    expect(
      deriveRecommendation(
        input({ stage: "CONFIRMED", aiScore: 59, hasCatalystSource: false, sourceCount: 1 }),
      ),
    ).toBe("Watch");
  });

  it("returns Watch for catalyst-led with only 1 source", () => {
    // catalyst alone (single source) does not corroborate enough for Buy.
    expect(
      deriveRecommendation(
        input({ hasCatalystSource: true, sourceCount: 1, aiScore: 70, stage: "EARLY" }),
      ),
    ).toBe("Watch");
  });

  it("is deterministic — same input always produces same output", () => {
    const i = input({ stage: "CONFIRMED", aiScore: 62, sourceCount: 2 });
    expect(deriveRecommendation(i)).toBe(deriveRecommendation(i));
  });
});
