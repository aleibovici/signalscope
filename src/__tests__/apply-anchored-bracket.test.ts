import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTradeBracket = vi.fn();
vi.mock("@/lib/anchors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anchors")>("@/lib/anchors");
  return {
    ...actual,
    getTradeBracket: (...args: unknown[]) => mockGetTradeBracket(...args),
  };
});

import { applyAnchoredBracket } from "@/lib/harvester/report";
import { TickerStage } from "@/generated/prisma/client";
import type { TradeSetup } from "@/lib/harvester/types";

beforeEach(() => {
  mockGetTradeBracket.mockReset();
});

const aiSetup = (overrides: Partial<TradeSetup> = {}): TradeSetup => ({
  entryLo: 99,
  entryHi: 101, // midpoint 100
  // AI numbers that should all be overridden
  stopLoss: 90,
  target1: 120,
  target2: 135,
  timeframe: "1-3 weeks",
  riskReward: "1:2",
  confidence: "Medium",
  ...overrides,
});

describe("applyAnchoredBracket", () => {
  it("overrides AI target/stop with anchor-derived values", async () => {
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });

    const result = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
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
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
    expect(result!.entryLo).toBe(99);
    expect(result!.entryHi).toBe(101);
  });

  it("sets timeframe from stage hold-days (EARLY = 5)", async () => {
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
    expect(result!.timeframe).toBe("up to 5 days");
  });

  it("sets timeframe from stage hold-days (CONFIRMED = 7)", async () => {
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.15,
      stopPct: -0.1,
      source: "anchor",
      sampleSize: 20,
    });
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.CONFIRMED);
    expect(result!.timeframe).toBe("up to 7 days");
  });

  it("emits riskReward as 1:1.5 (the invariant ratio)", async () => {
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
    expect(result!.riskReward).toBe("1:1.5");
  });

  it("preserves AI confidence", async () => {
    mockGetTradeBracket.mockResolvedValueOnce({
      targetPct: 0.06,
      stopPct: -0.04,
      source: "anchor",
      sampleSize: 50,
    });
    const result = await applyAnchoredBracket(aiSetup({ confidence: "High" }), TickerStage.EARLY);
    expect(result!.confidence).toBe("High");
  });

  it("drops setup entirely when entry range is missing", async () => {
    const result = await applyAnchoredBracket(undefined, TickerStage.EARLY);
    expect(result).toBeUndefined();
    expect(mockGetTradeBracket).not.toHaveBeenCalled();
  });

  it("drops setup when entryLo is invalid (NaN)", async () => {
    const bad = aiSetup({ entryLo: NaN });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("drops setup when entryHi < entryLo", async () => {
    const bad = aiSetup({ entryLo: 105, entryHi: 100 });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("drops setup when entry price is zero or negative", async () => {
    const bad = aiSetup({ entryLo: 0, entryHi: 0 });
    const result = await applyAnchoredBracket(bad, TickerStage.EARLY);
    expect(result).toBeUndefined();
  });

  it("falls back to per-stage FALLBACK_TARGET_PCT when anchor lookup throws (EARLY = 6%)", async () => {
    // DB unavailable. Must still produce sensible numbers — never persist
    // the LLM's placeholder zeros (entryLo=99, entryHi=101 → midpoint 100):
    //   FALLBACK_TARGET_PCT.EARLY = 0.06
    //   target1  = 100 * (1 + 0.06)        = 106
    //   target2  = 100 * (1 + 0.06 * 1.5)  = 109
    //   stopLoss = 100 * (1 - 0.06/1.5)    = 96
    mockGetTradeBracket.mockRejectedValueOnce(new Error("DB unavailable"));
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
    expect(result).toBeDefined();
    expect(result!.target1).toBe(106);
    expect(result!.target2).toBe(109);
    expect(result!.stopLoss).toBe(96);
    expect(result!.timeframe).toBe("up to 5 days");
    expect(result!.riskReward).toBe("1:1.5");
  });

  it("falls back to per-stage FALLBACK_TARGET_PCT when anchor lookup throws (CONFIRMED = 15%)", async () => {
    mockGetTradeBracket.mockRejectedValueOnce(new Error("DB unavailable"));
    const result = await applyAnchoredBracket(aiSetup(), TickerStage.CONFIRMED);
    expect(result).toBeDefined();
    // 100 * 1.15 = 115
    expect(result!.target1).toBe(115);
    // 100 * (1 + 0.15 * 1.5) = 122.5
    expect(result!.target2).toBe(122.5);
    // 100 * (1 - 0.10) = 90
    expect(result!.stopLoss).toBe(90);
    expect(result!.timeframe).toBe("up to 7 days");
  });

  it("overrides LLM placeholder zeros even when the anchor lookup fails", async () => {
    // Mirrors the new LLM contract: it emits only entryLo/entryHi/confidence
    // (plus zero placeholders for the rest). On DB error, those zeros must
    // NOT be persisted — the fallback bracket has to do the math.
    mockGetTradeBracket.mockRejectedValueOnce(new Error("DB unavailable"));
    const placeholder: TradeSetup = {
      entryLo: 99,
      entryHi: 101,
      stopLoss: 0,
      target1: 0,
      target2: 0,
      timeframe: "",
      riskReward: "",
      confidence: "Medium",
    };
    const result = await applyAnchoredBracket(placeholder, TickerStage.EARLY);
    expect(result).toBeDefined();
    expect(result!.stopLoss).not.toBe(0);
    expect(result!.target1).not.toBe(0);
    expect(result!.timeframe).not.toBe("");
  });

  it("uses different brackets for different stages", async () => {
    mockGetTradeBracket
      .mockResolvedValueOnce({ targetPct: 0.06, stopPct: -0.04, source: "anchor", sampleSize: 50 })
      .mockResolvedValueOnce({ targetPct: 0.15, stopPct: -0.1, source: "anchor", sampleSize: 20 });

    const early = await applyAnchoredBracket(aiSetup(), TickerStage.EARLY);
    const confirmed = await applyAnchoredBracket(aiSetup(), TickerStage.CONFIRMED);

    expect(confirmed!.target1).toBeGreaterThan(early!.target1);
    expect(confirmed!.stopLoss).toBeLessThan(early!.stopLoss);
  });
});
