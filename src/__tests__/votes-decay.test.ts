import { describe, it, expect } from "vitest";
import { computeDecayWeight, VOTE_HALF_LIFE_DAYS } from "@/lib/votes";

const DAY_MS = 86_400_000;

describe("computeDecayWeight", () => {
  it("returns 1 at age 0", () => {
    expect(computeDecayWeight(0)).toBe(1);
  });

  it("returns 1 for negative ages (clock skew guard)", () => {
    expect(computeDecayWeight(-1000)).toBe(1);
  });

  it("returns 0.5 at the half-life", () => {
    const result = computeDecayWeight(VOTE_HALF_LIFE_DAYS * DAY_MS);
    expect(result).toBeCloseTo(0.5, 9);
  });

  it("returns 0.25 at double the half-life", () => {
    const result = computeDecayWeight(VOTE_HALF_LIFE_DAYS * 2 * DAY_MS);
    expect(result).toBeCloseTo(0.25, 9);
  });

  it("is monotonically decreasing with age", () => {
    const ages = [1, 7, 30, 45, 90, 180].map((d) => d * DAY_MS);
    const weights = ages.map(computeDecayWeight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });
});
