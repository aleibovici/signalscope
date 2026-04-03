import { describe, expect, it } from "vitest";
import { totalReturnDecimalFromBars } from "@/lib/spy-benchmark";

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
