import { describe, expect, it } from "vitest";
import { totalReturnDecimalFromBars, spyReturnForTrade, type SpyHistoryBar } from "@/lib/spy-benchmark";

describe("totalReturnDecimalFromBars", () => {
  it("computes return from adj close first to last", () => {
    const rows = [
      { date: new Date("2026-01-01"), close: 100, adjClose: 100 },
      { date: new Date("2026-01-03"), close: 110, adjClose: 105 },
    ];
    expect(totalReturnDecimalFromBars(rows)).toBeCloseTo(0.05, 10);
  });

  it("falls back to close when adj close missing", () => {
    const rows = [
      { date: new Date("2026-01-01"), close: 200 },
      { date: new Date("2026-01-02"), close: 220 },
    ];
    expect(totalReturnDecimalFromBars(rows)).toBeCloseTo(0.1, 10);
  });

  it("sorts by date", () => {
    const rows = [
      { date: new Date("2026-01-05"), close: 110, adjClose: 110 },
      { date: new Date("2026-01-01"), close: 100, adjClose: 100 },
    ];
    expect(totalReturnDecimalFromBars(rows)).toBeCloseTo(0.1, 10);
  });

  it("returns null for fewer than 2 bars", () => {
    expect(totalReturnDecimalFromBars([{ date: new Date(), close: 1 }])).toBeNull();
    expect(totalReturnDecimalFromBars([])).toBeNull();
  });
});

// ─── spyReturnForTrade ─────────────────────────────────────────────────────
// Uses Unix epoch (day 0) as base so ms arithmetic is deterministic and
// independent of the system clock.

describe("spyReturnForTrade", () => {
  const DAY = 86400000;

  // Helper: build a bar at a given day-offset from epoch
  function bar(dayOffset: number, price: number, adjClose?: number): SpyHistoryBar {
    return {
      date: new Date(dayOffset * DAY),
      close: price,
      ...(adjClose !== undefined ? { adjClose } : {}),
    };
  }

  // Canonical set: day 0, 3, 7 — covers both 3d and 7d hold periods
  const threeBars: SpyHistoryBar[] = [bar(0, 500), bar(3, 515), bar(7, 560)];

  it("returns null when holdDays is null", () => {
    expect(spyReturnForTrade(threeBars, new Date(0), null)).toBeNull();
  });

  it("returns null when holdDays is an unrecognised string", () => {
    // "2d" and "5d" are not in HOLD_DAYS_MAP
    expect(spyReturnForTrade(threeBars, new Date(0), "2d")).toBeNull();
    expect(spyReturnForTrade(threeBars, new Date(0), "5d")).toBeNull();
  });

  it("returns null when bars is empty (length < 2 guard)", () => {
    expect(spyReturnForTrade([], new Date(0), "7d")).toBeNull();
  });

  it("returns null when bars has only one entry", () => {
    expect(spyReturnForTrade([bar(0, 500)], new Date(0), "7d")).toBeNull();
  });

  it("computes 7d return correctly", () => {
    // Entry = day 0 bar (500).  Exit target = day 7 → threshold = day 6.
    // bar(day7=560) >= day6 threshold → exit = 560.
    // return = (560 − 500) / 500 = 0.12
    const result = spyReturnForTrade(threeBars, new Date(0), "7d");
    expect(result).toBeCloseTo(0.12, 5);
  });

  it("computes 3d return correctly using findBarOnOrAfter tolerance", () => {
    // Entry = day 0 bar (500).  Exit target = day 3 → threshold = day 2.
    // bar(day3=515) >= day2 threshold → exit = 515.
    // return = (515 − 500) / 500 = 0.03
    const result = spyReturnForTrade(threeBars, new Date(0), "3d");
    expect(result).toBeCloseTo(0.03, 5);
  });

  it("returns null when entry and exit bars resolve to the same object", () => {
    // 1d hold: exitTarget = day1, threshold = day0.
    // findBarOnOrAfter finds bar(day0) for BOTH entry and exit → entryBar === exitBar → null.
    // (The 1-day tolerance means the entry bar is always within the exit window for 1d holds.)
    const result = spyReturnForTrade([bar(0, 500), bar(7, 560)], new Date(0), "1d");
    expect(result).toBeNull();
  });

  it("uses adjClose over close when adjClose is present", () => {
    // adjClose values: 490 and 539.  close values would give 560/500 − 1 = 0.12.
    const adjBars: SpyHistoryBar[] = [
      bar(0, 500, 490),  // adjClose=490
      bar(7, 560, 539),  // adjClose=539
    ];
    // (539 − 490) / 490 ≈ 0.1
    const result = spyReturnForTrade(adjBars, new Date(0), "7d");
    expect(result).toBeCloseTo(49 / 490, 5);
  });

  it("falls back to close when adjClose is absent", () => {
    const plainBars: SpyHistoryBar[] = [bar(0, 400), bar(7, 480)];
    // (480 − 400) / 400 = 0.2
    expect(spyReturnForTrade(plainBars, new Date(0), "7d")).toBeCloseTo(0.2, 5);
  });

  it("returns null when entry bar close is zero (division-by-zero guard)", () => {
    const zeroBars: SpyHistoryBar[] = [bar(0, 0), bar(7, 500)];
    expect(spyReturnForTrade(zeroBars, new Date(0), "7d")).toBeNull();
  });

  it("falls back to last bar when no bar is near enough to exit target", () => {
    // Only two bars: day 0 and day 3.  For a 7d hold the exit target is day 7,
    // threshold = day 6.  bar(day3) < day6 → loop finds nothing → falls back to
    // bars[last] = day3.  entry(day0) !== exit(day3) → computes return.
    const sparseBars: SpyHistoryBar[] = [bar(0, 500), bar(3, 515)];
    const result = spyReturnForTrade(sparseBars, new Date(0), "7d");
    expect(result).toBeCloseTo(0.03, 5); // (515 − 500) / 500
  });
});
