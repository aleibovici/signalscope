import { describe, it, expect, beforeEach } from "vitest";
import { addCost, getTotalCost, resetCostTracker } from "@/lib/ai/cost-tracker";

describe("cost-tracker", () => {
  beforeEach(() => {
    resetCostTracker();
  });

  it("starts at zero after reset", () => {
    expect(getTotalCost()).toBe(0);
  });

  it("accumulates costs", () => {
    addCost(0.01);
    addCost(0.02);
    expect(getTotalCost()).toBeCloseTo(0.03);
  });

  it("resets to zero", () => {
    addCost(0.5);
    resetCostTracker();
    expect(getTotalCost()).toBe(0);
  });

  it("handles multiple adds then reset then adds again", () => {
    addCost(1.0);
    addCost(2.0);
    resetCostTracker();
    addCost(0.5);
    expect(getTotalCost()).toBeCloseTo(0.5);
  });

  it("handles zero cost", () => {
    addCost(0);
    expect(getTotalCost()).toBe(0);
  });

  it("accumulates fractional costs accurately", () => {
    for (let i = 0; i < 10; i++) addCost(0.001);
    expect(getTotalCost()).toBeCloseTo(0.01);
  });
});
