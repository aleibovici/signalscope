import { describe, it, expect } from "vitest";
import { pickTopic, PROMO_TOPICS } from "@/lib/twitter/promo";

const VALID_PATHS = ["/dashboard", "/trending", "/connections", "/performance", "/methodology", "/portfolio", "/profile"];

describe("pickTopic", () => {
  it("returns a valid topic from the pool", () => {
    const topic = pickTopic(new Date("2026-03-25"), 0);
    expect(PROMO_TOPICS).toContain(topic);
  });

  it("returns 3 different topics for the same day", () => {
    const date = new Date("2026-03-25");
    const topics = [pickTopic(date, 0), pickTopic(date, 1), pickTopic(date, 2)];
    const ids = topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("returns different topics on consecutive days", () => {
    const day1 = pickTopic(new Date("2026-03-25"), 0);
    const day2 = pickTopic(new Date("2026-03-26"), 0);
    // Same slot, different day — should (almost certainly) pick different topics
    // This can theoretically collide if pool size divides evenly, but with 20 topics it won't
    expect(day1.id).not.toBe(day2.id);
  });

  it("cycles through all topics over enough days", () => {
    const seen = new Set<string>();
    for (let d = 0; d < 30; d++) {
      const date = new Date(2026, 2, 1 + d); // March 2026
      for (let slot = 0; slot < 3; slot++) {
        seen.add(pickTopic(date, slot).id);
      }
    }
    // 30 days × 3 slots = 90 picks, should cover all 20 topics
    expect(seen.size).toBe(PROMO_TOPICS.length);
  });
});

describe("PROMO_TOPICS", () => {
  it("has at least 15 topics for variety", () => {
    expect(PROMO_TOPICS.length).toBeGreaterThanOrEqual(15);
  });

  it("every topic has id, angle, and path", () => {
    for (const topic of PROMO_TOPICS) {
      expect(topic.id).toBeTruthy();
      expect(topic.angle).toBeTruthy();
      expect(topic.angle.length).toBeGreaterThan(20);
      expect(topic.path).toMatch(/^\//);
    }
  });

  it("has no duplicate ids", () => {
    const ids = PROMO_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every path points to a valid dashboard page", () => {
    for (const topic of PROMO_TOPICS) {
      expect(VALID_PATHS).toContain(topic.path);
    }
  });
});
