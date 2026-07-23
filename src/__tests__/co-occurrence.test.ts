import { describe, it, expect } from "vitest";
import { jaccardScore } from "@/lib/co-occurrence";

describe("jaccardScore", () => {
  it("returns 1 for identical sets", () => {
    // If A and B always appear together: coCount = totalA = totalB
    expect(jaccardScore(5, 5, 5)).toBe(1);
  });

  it("returns 0 when no co-occurrences", () => {
    expect(jaccardScore(0, 5, 5)).toBe(0);
  });

  it("returns 0 when union is zero", () => {
    expect(jaccardScore(0, 0, 0)).toBe(0);
  });

  it("computes correct score for partial overlap", () => {
    // A appears in 10 scans, B appears in 8 scans, 4 shared
    // Jaccard = 4 / (10 + 8 - 4) = 4/14 ≈ 0.2857
    const score = jaccardScore(4, 10, 8);
    expect(score).toBeCloseTo(0.2857, 3);
  });

  it("computes correct score when one set is subset", () => {
    // A appears in 10 scans, B appears in 3 scans, all 3 are shared
    // Jaccard = 3 / (10 + 3 - 3) = 3/10 = 0.3
    expect(jaccardScore(3, 10, 3)).toBe(0.3);
  });

  it("is symmetric", () => {
    expect(jaccardScore(3, 10, 5)).toBe(jaccardScore(3, 5, 10));
  });

  it("handles single scan overlap", () => {
    // A=1, B=1, co=1 → 1/(1+1-1) = 1
    expect(jaccardScore(1, 1, 1)).toBe(1);
  });

  it("handles large numbers", () => {
    const score = jaccardScore(100, 500, 300);
    // 100 / (500 + 300 - 100) = 100/700 ≈ 0.1429
    expect(score).toBeCloseTo(0.1429, 3);
  });
});
