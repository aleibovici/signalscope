import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResolveTradeBracket = vi.fn();
vi.mock("@/lib/anchors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anchors")>("@/lib/anchors");
  return {
    ...actual,
    resolveTradeBracket: (...args: unknown[]) => mockResolveTradeBracket(...args),
  };
});

import { applyAnchoredBracket } from "@/lib/harvester/report";
import { TickerStage } from "@/generated/prisma/client";
import type { TradeSetupDraft } from "@/lib/harvester/types";

beforeEach(() => {
  mockResolveTradeBracket.mockReset();
});

const draftSetup = (overrides: Partial<TradeSetupDraft> = {}): TradeSetupDraft => ({
  entryLo: 99,
  entryHi: 101,
  confidence: "Medium",
  ...overrides,
});

describe("applyAnchoredBracket", () => {
  it("overrides AI target/stop with anchor-derived values", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });

    const result = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    expect(result).toBeDefined();
    // Entry midpoint = 100, target1 = 100 * 1.06 = 106
    expect(result!.target1).toBe(106);
    // Target2 = 100 * (1 + 0.06 * 1.5) = 109
    expect(result!.target2).toBe(109);
    // Stop = 100 * (1 - 0.04) = 96
    expect(result!.stopLoss).toBe(96);
    // AI numbers ignored — never see 120, 135, 90
    expect(result!.target1).not.toBe(120);
    expect(result!.stopLoss).not.toBe(90);
  });

  it("preserves AI entryLo/entryHi unchanged", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    expect(result!.entryLo).toBe(99);
    expect(result!.entryHi).toBe(101);
  });

  it("sets timeframe from stage hold-days (EARLY = 5)", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    expect(result!.timeframe).toBe("up to 5 days");
  });

  it("sets timeframe from stage hold-days (CONFIRMED = 7)", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.15,
      stopPct: -0.1,
      source: "anchor",
      sampleSize: 20,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.CONFIRMED);
    expect(result!.timeframe).toBe("up to 7 days");
  });

  it("emits riskReward as 1:1.5 (the invariant ratio)", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    expect(result!.riskReward).toBe("1:1.5");
  });

  it("preserves AI confidence", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(draftSetup({ confidence: "High" }), TickerStage.EARLY);
    expect(result!.confidence).toBe("High");
  });

  it("drops setup entirely when entry range is missing", async () => {
    const result = await applyAnchoredBracket(undefined, TickerStage.EARLY);
    expect(result).toBeUndefined();
    expect(mockResolveTradeBracket).not.toHaveBeenCalled();
  });

  it("drops setup when entryLo is invalid (NaN)", async () => {
    const bad = draftSetup({ entryLo: NaN });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("drops setup when entryHi < entryLo", async () => {
    const bad = draftSetup({ entryLo: 105, entryHi: 100 });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("drops setup when entry price is zero or negative", async () => {
    const bad = draftSetup({ entryLo: 0, entryHi: 0 });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("uses per-stage fallback bracket when resolveTradeBracket returns EARLY fallback (6%)", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "fallback",
      sampleSize: 0,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    expect(result).toBeDefined();
    expect(result!.target1).toBe(106);
    expect(result!.target2).toBe(109);
    expect(result!.stopLoss).toBe(96);
    expect(result!.timeframe).toBe("up to 5 days");
    expect(result!.riskReward).toBe("1:1.5");
  });

  it("uses per-stage fallback bracket when resolveTradeBracket returns CONFIRMED fallback (15%)", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.15,
      stopPct: -0.1,
      source: "fallback",
      sampleSize: 0,
    });
    const result = await applyAnchoredBracket(draftSetup(), TickerStage.CONFIRMED);
    expect(result).toBeDefined();
    expect(result!.target1).toBe(115);
    expect(result!.target2).toBe(122.5);
    expect(result!.stopLoss).toBe(90);
    expect(result!.timeframe).toBe("up to 7 days");
  });

  it("builds bracket from draft-only input", async () => {
    mockResolveTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "fallback",
      sampleSize: 0,
    });
    const result = await applyAnchoredBracket(
      { entryLo: 99, entryHi: 101, confidence: "Medium" },
      TickerStage.EARLY,
    );
    expect(result).toBeDefined();
    expect(result!.stopLoss).not.toBe(0);
    expect(result!.target1).not.toBe(0);
    expect(result!.timeframe).not.toBe("");
  });

  it("uses different brackets for different stages", async () => {
    mockResolveTradeBracket
      .mockResolvedValueOnce({ targetPct: 0.06, stopPct: -0.04, source: "anchor", sampleSize: 50 })
      .mockResolvedValueOnce({ targetPct: 0.15, stopPct: -0.1, source: "anchor", sampleSize: 20 });

    const early = await applyAnchoredBracket(draftSetup(), TickerStage.EARLY);
    const confirmed = await applyAnchoredBracket(draftSetup(), TickerStage.CONFIRMED);

    expect(confirmed!.target1).toBeGreaterThan(early!.target1);
    expect(confirmed!.stopLoss).toBeLessThan(early!.stopLoss);
  });
});
