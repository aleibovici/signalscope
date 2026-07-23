import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";
import {
  countHighConvOptionsFlow,
  assessRegime,
  getTrailingHighConvMean,
  isRegimeSkipEnabled,
  SCAN_OF_CONV_DELTA_P85,
  REGIME_TRAILING_WINDOW,
} from "@/lib/harvester/regime-filter";

function ofSignal(symbol: string, title: string): RawSignal {
  return { symbol, source: "OPTIONS_FLOW", title };
}

describe("countHighConvOptionsFlow", () => {
  it("counts Call sweep and Heavy OTM titles", () => {
    const signals: RawSignal[] = [
      ofSignal("AAPL", "Call sweep detected: AAPL 2026-06-20 (4 strikes)"),
      ofSignal("TSLA", "Heavy OTM call activity: TSLA (3 strikes)"),
      ofSignal("AMD", "Call sweep detected: AMD 2026-07-18 (5 strikes)"),
    ];
    expect(countHighConvOptionsFlow(signals)).toBe(3);
  });

  it("excludes 'Unusual call volume' OPTIONS_FLOW titles (per exp668 definition)", () => {
    const signals: RawSignal[] = [
      ofSignal("NVDA", "Unusual call volume: NVDA $500 2026-06-20"),
      ofSignal("META", "Call sweep detected: META 2026-06-20 (2 strikes)"),
    ];
    expect(countHighConvOptionsFlow(signals)).toBe(1);
  });

  it("excludes non-OPTIONS_FLOW sources even with matching prefixes", () => {
    const signals: RawSignal[] = [
      { symbol: "X", source: "REDDIT", title: "Call sweep on X today" },
      { symbol: "X", source: "TWITTER", title: "Heavy OTM looking great" },
      ofSignal("X", "Call sweep detected: X 2026-06-20 (1 strike)"),
    ];
    expect(countHighConvOptionsFlow(signals)).toBe(1);
  });

  it("handles missing titles without throwing", () => {
    const signals: RawSignal[] = [
      { symbol: "X", source: "OPTIONS_FLOW" },
      ofSignal("Y", "Call sweep detected: Y"),
    ];
    expect(countHighConvOptionsFlow(signals)).toBe(1);
  });
});

describe("assessRegime", () => {
  it("does not skip when feature flag is off, regardless of delta", () => {
    const r = assessRegime(100, 0, false);
    expect(r.skip).toBe(false);
    expect(r.scanOfConvDelta).toBe(100);
  });

  it("does not skip when delta equals threshold (strict >)", () => {
    const r = assessRegime(SCAN_OF_CONV_DELTA_P85, 0, true);
    expect(r.scanOfConvDelta).toBe(SCAN_OF_CONV_DELTA_P85);
    expect(r.skip).toBe(false);
  });

  it("skips when delta exceeds threshold AND flag is on", () => {
    const r = assessRegime(SCAN_OF_CONV_DELTA_P85 + 0.01, 0, true);
    expect(r.skip).toBe(true);
  });

  it("computes delta as high_conv - trailing", () => {
    const r = assessRegime(10, 3.5, true);
    expect(r.scanOfConvDelta).toBeCloseTo(6.5, 5);
  });

  it("can produce negative delta (trailing was higher) and never skips on negatives", () => {
    const r = assessRegime(2, 10, true);
    expect(r.scanOfConvDelta).toBe(-8);
    expect(r.skip).toBe(false);
  });
});

describe("isRegimeSkipEnabled", () => {
  const original = process.env.REGIME_SKIP_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.REGIME_SKIP_ENABLED;
    else process.env.REGIME_SKIP_ENABLED = original;
  });

  it("returns false when unset", () => {
    delete process.env.REGIME_SKIP_ENABLED;
    expect(isRegimeSkipEnabled()).toBe(false);
  });

  it("returns false for any value other than literal 'true'", () => {
    process.env.REGIME_SKIP_ENABLED = "1";
    expect(isRegimeSkipEnabled()).toBe(false);
    process.env.REGIME_SKIP_ENABLED = "TRUE";
    expect(isRegimeSkipEnabled()).toBe(false);
  });

  it("returns true only for literal 'true'", () => {
    process.env.REGIME_SKIP_ENABLED = "true";
    expect(isRegimeSkipEnabled()).toBe(true);
  });
});

describe("getTrailingHighConvMean", () => {
  function mockPrisma(rows: Array<{ scanOfHighConv: number | null }>) {
    return {
      scan: {
        findMany: vi.fn(async () => rows),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when there are no prior scans (matches harness fillna(0))", async () => {
    const prisma = mockPrisma([]);
    const mean = await getTrailingHighConvMean(prisma, new Date());
    expect(mean).toBe(0);
  });

  it("averages whatever scans are present (not always /5)", async () => {
    const prisma = mockPrisma([
      { scanOfHighConv: 3 },
      { scanOfHighConv: 5 },
      { scanOfHighConv: 7 },
    ]);
    const mean = await getTrailingHighConvMean(prisma, new Date());
    expect(mean).toBe(5);
  });

  it("takes only the last REGIME_TRAILING_WINDOW scans (caller-side via prisma.take)", async () => {
    const prisma = mockPrisma([
      { scanOfHighConv: 10 },
      { scanOfHighConv: 10 },
      { scanOfHighConv: 10 },
      { scanOfHighConv: 10 },
      { scanOfHighConv: 10 },
    ]);
    const mean = await getTrailingHighConvMean(prisma, new Date());
    expect(mean).toBe(10);
    expect(prisma.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: REGIME_TRAILING_WINDOW })
    );
  });

  it("treats null scanOfHighConv as 0", async () => {
    const prisma = mockPrisma([
      { scanOfHighConv: 4 },
      { scanOfHighConv: null },
    ]);
    const mean = await getTrailingHighConvMean(prisma, new Date());
    expect(mean).toBe(2);
  });
});
