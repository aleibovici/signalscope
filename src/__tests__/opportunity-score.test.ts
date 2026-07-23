import { describe, it, expect } from "vitest";
import { computeOpportunityScore } from "@/lib/harvester/opportunity-score";

const baseInput = {
  aiScore: 50,
  firstSeenDaysAgo: 5,
  priorAppearances: 2,
  avgVelocity: 1.0,
  price: 10,
  marketCap: 1_000_000_000,
  wk52Lo: 8,
  wk52Hi: 20,
  medianSignalAgeHrs: 10,
  shortFloat: 0.05,
  sourceCount: 2,
  stage: "EARLY",
};

describe("computeOpportunityScore", () => {
  it("novel micro-cap with high velocity scores ~90+", () => {
    const score = computeOpportunityScore({
      aiScore: 20,
      firstSeenDaysAgo: null, // truly novel → 30
      priorAppearances: 0,
      avgVelocity: 3.0, // → 15
      price: 2.5,
      marketCap: 30_000_000, // → 15
      wk52Lo: 2.0,
      wk52Hi: 10.0,
      medianSignalAgeHrs: 1, // → 5
      shortFloat: 0.20, // → 5
      sourceCount: 2,
      stage: "EARLY",
    });
    // novelty 14 + inverted 20 + velocity 15 + cap 15 + near52wkLow 10 + short 5 + freshness 5 + recovery 5 (ratio 4.0) = 89
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("stale large-cap with high aiScore scores ~10-20", () => {
    const score = computeOpportunityScore({
      aiScore: 90,
      firstSeenDaysAgo: 20,
      priorAppearances: 10,
      avgVelocity: 0.5,
      price: 150,
      marketCap: 50_000_000_000, // large cap → 0
      wk52Lo: 100,
      wk52Hi: 200,
      medianSignalAgeHrs: 24,
      shortFloat: 0.02,
      sourceCount: 4,
      stage: "CONFIRMED",
    });
    // novelty ~0 + inverted ~2 + velocity 0 + cap 0 + near52wk 5 + short 0 + fresh 0 + recovery 0 (ratio 1.3) = ~7
    expect(score).toBeLessThanOrEqual(20);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("truly novel ticker gets max novelty (20)", () => {
    const score = computeOpportunityScore({ ...baseInput, firstSeenDaysAgo: null });
    const scoreNotNovel = computeOpportunityScore({ ...baseInput, firstSeenDaysAgo: 10 });
    expect(score).toBeGreaterThan(scoreNotNovel);
  });

  it("3-5 day old ticker gets max age score (sweet spot for near-term returns)", () => {
    const score0 = computeOpportunityScore({ ...baseInput, firstSeenDaysAgo: 0 }); // 14 pts
    const score4 = computeOpportunityScore({ ...baseInput, firstSeenDaysAgo: 4 }); // 20 pts (sweet spot)
    const scoreNovel = computeOpportunityScore({ ...baseInput, firstSeenDaysAgo: null }); // 14 pts
    expect(score4).toBeGreaterThan(score0);
    expect(score4).toBeGreaterThan(scoreNovel);
  });

  it("low aiScore gets higher inverted confidence than high aiScore", () => {
    const lowAi = computeOpportunityScore({ ...baseInput, aiScore: 10 });
    const highAi = computeOpportunityScore({ ...baseInput, aiScore: 90 });
    expect(lowAi).toBeGreaterThan(highAi);
  });

  it("high velocity scores more than low velocity", () => {
    const highVel = computeOpportunityScore({ ...baseInput, avgVelocity: 3.0 });
    const lowVel = computeOpportunityScore({ ...baseInput, avgVelocity: 0.5 });
    expect(highVel).toBeGreaterThan(lowVel);
  });

  it("micro-cap scores more than large-cap", () => {
    const micro = computeOpportunityScore({ ...baseInput, marketCap: 20_000_000 });
    const large = computeOpportunityScore({ ...baseInput, marketCap: 100_000_000_000 });
    expect(micro).toBeGreaterThan(large);
  });

  it("penalizes mega-caps enough that fresh chatter does not look like an emerging breakout", () => {
    const megaCap = computeOpportunityScore({
      aiScore: 35,
      firstSeenDaysAgo: null,
      priorAppearances: 0,
      avgVelocity: 3.0,
      price: 250,
      marketCap: 150_000_000_000,
      wk52Lo: 200,
      wk52Hi: 260,
      medianSignalAgeHrs: 1,
      shortFloat: 0.02,
      sourceCount: 3,
      stage: "FORMING",
      totalUpvotes: 500,
      totalComments: 50,
    });
    const smallCap = computeOpportunityScore({
      ...baseInput,
      aiScore: 45,
      firstSeenDaysAgo: 2,
      avgVelocity: 2.0,
      marketCap: 250_000_000,
      medianSignalAgeHrs: 2,
    });

    expect(megaCap).toBeLessThan(smallCap);
  });

  it("clamps to [0, 100]", () => {
    // Minimum possible
    const minScore = computeOpportunityScore({
      aiScore: 100,
      firstSeenDaysAgo: 30,
      priorAppearances: 20,
      avgVelocity: 0,
      price: 500,
      marketCap: 500_000_000_000,
      wk52Lo: 100,
      wk52Hi: 600,
      medianSignalAgeHrs: 100,
      shortFloat: 0,
      sourceCount: 1,
      stage: "CONFIRMED",
    });
    expect(minScore).toBeGreaterThanOrEqual(0);
    expect(minScore).toBeLessThanOrEqual(100);

    // Maximum possible
    const maxScore = computeOpportunityScore({
      aiScore: 0,
      firstSeenDaysAgo: null,
      priorAppearances: 0,
      avgVelocity: 5.0,
      price: 1.5,
      marketCap: 10_000_000,
      wk52Lo: 1.0,
      wk52Hi: 10.0,
      medianSignalAgeHrs: 0.5,
      shortFloat: 0.30,
      sourceCount: 3,
      stage: "EARLY",
    });
    expect(maxScore).toBeLessThanOrEqual(100);
    expect(maxScore).toBeGreaterThanOrEqual(0);
  });

  it("handles null/undefined optional fields gracefully", () => {
    const score = computeOpportunityScore({
      aiScore: 50,
      firstSeenDaysAgo: null,
      priorAppearances: 0,
      avgVelocity: 1.5,
      price: null,
      marketCap: null,
      wk52Lo: null,
      wk52Hi: null,
      medianSignalAgeHrs: null,
      shortFloat: null,
      sourceCount: 1,
      stage: "EARLY",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("applies comment-heavy penalty (>150 comments, ratio < 2:1)", () => {
    const withPenalty = computeOpportunityScore({
      ...baseInput,
      totalUpvotes: 200,
      totalComments: 200, // ratio 1:1, comments > 150
    });
    const without = computeOpportunityScore({
      ...baseInput,
      totalUpvotes: 200,
      totalComments: 20, // ratio 10:1, no penalty
    });
    expect(withPenalty).toBeLessThan(without);
  });

  it("applies conviction bonus (>200 upvotes, ratio > 5:1)", () => {
    const withBonus = computeOpportunityScore({
      ...baseInput,
      totalUpvotes: 500,
      totalComments: 30, // ratio ~17:1
    });
    const without = computeOpportunityScore({
      ...baseInput,
      totalUpvotes: 100,
      totalComments: 30, // upvotes <= 200, no bonus
    });
    expect(withBonus).toBeGreaterThan(without);
  });

  it("moderate comments (33-150) get engagement boost, not penalty", () => {
    const withModerateComments = computeOpportunityScore({
      ...baseInput,
      totalUpvotes: 100,
      totalComments: 100, // ratio < 2 but comments 33-150 → moderate engagement boost (+3)
    });
    const withoutComments = computeOpportunityScore({
      ...baseInput,
      // no upvotes/comments → no adjustment
    });
    expect(withModerateComments).toBeGreaterThan(withoutComments);
  });
});
