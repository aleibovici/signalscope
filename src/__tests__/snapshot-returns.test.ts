import { describe, it, expect } from "vitest";
import { computeReturnsFromSnapshots, detectCorporateAction, INTERVAL_TARGETS } from "@/lib/snapshots/returns";

function hoursAfter(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function makeSnapshot(price: number, createdAt: Date) {
  return { price, createdAt };
}

const DETECTION_TIME = new Date("2025-03-01T14:30:00Z");
const DETECTION_PRICE = 10.0;

describe("computeReturnsFromSnapshots", () => {
  it("returns all nulls for empty snapshots", () => {
    const result = computeReturnsFromSnapshots([], DETECTION_PRICE, DETECTION_TIME);
    expect(result.return1d).toBeNull();
    expect(result.return3d).toBeNull();
    expect(result.return7d).toBeNull();
    expect(result.return30d).toBeNull();
  });

  it("returns all nulls for zero detection price", () => {
    const snapshots = [makeSnapshot(12, hoursAfter(DETECTION_TIME, 24))];
    const result = computeReturnsFromSnapshots(snapshots, 0, DETECTION_TIME);
    expect(result.return1d).toBeNull();
  });

  it("computes 1d return for snapshot at exactly 24 hours", () => {
    const snapshots = [makeSnapshot(12, hoursAfter(DETECTION_TIME, 24))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(0.2); // (12 - 10) / 10
    expect(result.price1d).toBe(12);
    expect(result.snapped1dAt).toEqual(hoursAfter(DETECTION_TIME, 24));
  });

  it("computes negative return correctly", () => {
    const snapshots = [makeSnapshot(8, hoursAfter(DETECTION_TIME, 24))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(-0.2); // (8 - 10) / 10
    expect(result.price1d).toBe(8);
  });

  it("picks closest snapshot to target time within tolerance", () => {
    // Two snapshots within the 1d window (18h-48h), one closer to 24h target
    const snapshots = [
      makeSnapshot(11, hoursAfter(DETECTION_TIME, 20)), // 4h from target
      makeSnapshot(13, hoursAfter(DETECTION_TIME, 25)), // 1h from target (closer)
    ];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.price1d).toBe(13); // picked the closer one
    expect(result.return1d).toBeCloseTo(0.3);
  });

  it("ignores snapshots outside tolerance window", () => {
    // Snapshot at 10h — too early for 1d (min 18h)
    const snapshots = [makeSnapshot(15, hoursAfter(DETECTION_TIME, 10))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeNull();
  });

  it("ignores snapshots past max tolerance", () => {
    // Snapshot at 50h — past max for 1d (max 48h)
    const snapshots = [makeSnapshot(15, hoursAfter(DETECTION_TIME, 50))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeNull();
  });

  it("computes all four return periods from a rich time series", () => {
    const snapshots = [
      // Early snapshots (won't match any period — too soon)
      makeSnapshot(10.5, hoursAfter(DETECTION_TIME, 6)),
      makeSnapshot(10.8, hoursAfter(DETECTION_TIME, 12)),
      // 1d range (18-48h, target 24h)
      makeSnapshot(11, hoursAfter(DETECTION_TIME, 24)),
      // 3d range (54-120h, target 72h)
      makeSnapshot(12, hoursAfter(DETECTION_TIME, 72)),
      // 7d range (120-264h, target 168h)
      makeSnapshot(14, hoursAfter(DETECTION_TIME, 168)),
      // 30d range (600-888h, target 720h)
      makeSnapshot(20, hoursAfter(DETECTION_TIME, 720)),
    ];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(0.1);  // (11 - 10) / 10
    expect(result.return3d).toBeCloseTo(0.2);  // (12 - 10) / 10
    expect(result.return7d).toBeCloseTo(0.4);  // (14 - 10) / 10
    expect(result.return30d).toBeCloseTo(1.0); // (20 - 10) / 10

    expect(result.price1d).toBe(11);
    expect(result.price3d).toBe(12);
    expect(result.price7d).toBe(14);
    expect(result.price30d).toBe(20);
  });

  it("fills earlier periods even when later ones are not yet available", () => {
    // Ticker is only 2 days old — should have 1d but not 3d/7d/30d
    const snapshots = [
      makeSnapshot(11, hoursAfter(DETECTION_TIME, 24)),
      makeSnapshot(11.5, hoursAfter(DETECTION_TIME, 36)),
    ];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(0.1);
    expect(result.return3d).toBeNull();
    expect(result.return7d).toBeNull();
    expect(result.return30d).toBeNull();
  });

  it("handles weekend gap for 1d — snapshot at 42h still qualifies", () => {
    // Market closed Sat/Sun, first snapshot available Monday morning = ~42h after Friday detection
    const snapshots = [makeSnapshot(11, hoursAfter(DETECTION_TIME, 42))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(0.1);
    expect(result.price1d).toBe(11);
  });

  it("handles 3-day weekend gap for 3d — snapshot at 110h still qualifies", () => {
    // 3d target is 72h, max tolerance is 120h
    const snapshots = [makeSnapshot(13, hoursAfter(DETECTION_TIME, 110))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return3d).toBeCloseTo(0.3);
  });

  it("updates returns as new snapshots become closer to target", () => {
    // First run: only one snapshot, not ideal distance
    const snapshot1 = makeSnapshot(11, hoursAfter(DETECTION_TIME, 20));
    const result1 = computeReturnsFromSnapshots([snapshot1], DETECTION_PRICE, DETECTION_TIME);
    expect(result1.price1d).toBe(11);

    // Second run: new snapshot closer to 24h target replaces
    const snapshot2 = makeSnapshot(11.5, hoursAfter(DETECTION_TIME, 24));
    const result2 = computeReturnsFromSnapshots([snapshot1, snapshot2], DETECTION_PRICE, DETECTION_TIME);
    expect(result2.price1d).toBe(11.5); // updated to closer snapshot
    expect(result2.return1d).toBeCloseTo(0.15);
  });

  it("a single snapshot can only match one period (closest wins)", () => {
    // Snapshot at 48h — within both 1d (18-48h) and 3d (54-120h) windows?
    // Actually 48h is within 1d but NOT within 3d (min 54h)
    const snapshots = [makeSnapshot(12, hoursAfter(DETECTION_TIME, 48))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(0.2);
    expect(result.return3d).toBeNull(); // 48h < 54h min for 3d
  });

  it("tolerance windows do not overlap — prevents double-counting", () => {
    // Verify that no hour value falls into two interval windows
    for (let i = 0; i < INTERVAL_TARGETS.length - 1; i++) {
      const current = INTERVAL_TARGETS[i];
      const next = INTERVAL_TARGETS[i + 1];
      expect(current.maxHours).toBeLessThanOrEqual(next.minHours);
    }
  });

  it("computes 14d return for snapshot at exactly 336 hours", () => {
    const snapshots = [makeSnapshot(15, hoursAfter(DETECTION_TIME, 336))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);
    expect(result.return14d).toBeCloseTo(0.5);
    expect(result.price14d).toBe(15);
    expect(result.snapped14dAt).toEqual(hoursAfter(DETECTION_TIME, 336));
  });

  it("ignores snapshots before 14d min window (264h)", () => {
    const snapshots = [makeSnapshot(15, hoursAfter(DETECTION_TIME, 263))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);
    expect(result.return14d).toBeNull();
  });

  it("ignores snapshots past 14d max window (408h)", () => {
    const snapshots = [makeSnapshot(15, hoursAfter(DETECTION_TIME, 410))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);
    expect(result.return14d).toBeNull();
  });

  it("computes all five return periods from a rich time series including 14d", () => {
    const snapshots = [
      makeSnapshot(11, hoursAfter(DETECTION_TIME, 24)),
      makeSnapshot(12, hoursAfter(DETECTION_TIME, 72)),
      makeSnapshot(14, hoursAfter(DETECTION_TIME, 168)),
      makeSnapshot(17, hoursAfter(DETECTION_TIME, 336)),
      makeSnapshot(20, hoursAfter(DETECTION_TIME, 720)),
    ];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);
    expect(result.return1d).toBeCloseTo(0.1);
    expect(result.return3d).toBeCloseTo(0.2);
    expect(result.return7d).toBeCloseTo(0.4);
    expect(result.return14d).toBeCloseTo(0.7);
    expect(result.return30d).toBeCloseTo(1.0);
    expect(result.price14d).toBe(17);
  });

  it("handles detection price as penny stock correctly", () => {
    const snapshots = [makeSnapshot(0.02, hoursAfter(DETECTION_TIME, 24))];
    const result = computeReturnsFromSnapshots(snapshots, 0.01, DETECTION_TIME);

    expect(result.return1d).toBeCloseTo(1.0); // 100% gain
    expect(result.price1d).toBe(0.02);
  });

  it("handles zero return (no price change)", () => {
    const snapshots = [makeSnapshot(10, hoursAfter(DETECTION_TIME, 24))];
    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    expect(result.return1d).toBe(0);
  });

  it("with twice-daily snapshots, always has data for each period", () => {
    // Simulate 30 days of twice-daily snapshots (market open + close)
    const snapshots = [];
    for (let day = 0; day < 31; day++) {
      // Morning snapshot (market open ~9:30h into the day)
      snapshots.push(makeSnapshot(10 + day * 0.1, hoursAfter(DETECTION_TIME, day * 24 + 9.5)));
      // Afternoon snapshot (market close ~16h into the day)
      snapshots.push(makeSnapshot(10 + day * 0.1 + 0.05, hoursAfter(DETECTION_TIME, day * 24 + 16)));
    }

    const result = computeReturnsFromSnapshots(snapshots, DETECTION_PRICE, DETECTION_TIME);

    // All four periods should be filled
    expect(result.return1d).not.toBeNull();
    expect(result.return3d).not.toBeNull();
    expect(result.return7d).not.toBeNull();
    expect(result.return30d).not.toBeNull();

    // All prices should be positive
    expect(result.price1d).toBeGreaterThan(0);
    expect(result.price3d).toBeGreaterThan(0);
    expect(result.price7d).toBeGreaterThan(0);
    expect(result.price30d).toBeGreaterThan(0);
  });
});

describe("detectCorporateAction", () => {
  it("returns false for empty snapshots", () => {
    expect(detectCorporateAction([], 10)).toBe(false);
  });

  it("returns false for zero detection price", () => {
    expect(detectCorporateAction([makeSnapshot(50, hoursAfter(DETECTION_TIME, 24))], 0)).toBe(false);
  });

  it("returns false for normal price movement", () => {
    const snapshots = [
      makeSnapshot(10.5, hoursAfter(DETECTION_TIME, 12)),
      makeSnapshot(11.0, hoursAfter(DETECTION_TIME, 24)),
      makeSnapshot(12.0, hoursAfter(DETECTION_TIME, 36)),
      makeSnapshot(9.5, hoursAfter(DETECTION_TIME, 48)),
    ];
    expect(detectCorporateAction(snapshots, 10)).toBe(false);
  });

  it("returns false for a legitimate 4x move across multiple snapshots", () => {
    // Price doubles over many snapshots — each step < 5x
    const snapshots = [
      makeSnapshot(12, hoursAfter(DETECTION_TIME, 12)),
      makeSnapshot(16, hoursAfter(DETECTION_TIME, 24)),
      makeSnapshot(22, hoursAfter(DETECTION_TIME, 36)),
      makeSnapshot(30, hoursAfter(DETECTION_TIME, 48)),
      makeSnapshot(38, hoursAfter(DETECTION_TIME, 60)),
    ];
    expect(detectCorporateAction(snapshots, 10)).toBe(false);
  });

  it("detects reverse split — detection price to first snapshot > 5x", () => {
    // BHAT scenario: $0.04 → $1.42 (35x jump)
    const snapshots = [
      makeSnapshot(1.42, hoursAfter(DETECTION_TIME, 24)),
    ];
    expect(detectCorporateAction(snapshots, 0.04)).toBe(true);
  });

  it("detects reverse split — large jump between consecutive snapshots", () => {
    const snapshots = [
      makeSnapshot(0.05, hoursAfter(DETECTION_TIME, 12)),
      makeSnapshot(0.06, hoursAfter(DETECTION_TIME, 24)),
      // Reverse split happens here
      makeSnapshot(1.50, hoursAfter(DETECTION_TIME, 36)),
      makeSnapshot(1.45, hoursAfter(DETECTION_TIME, 48)),
    ];
    expect(detectCorporateAction(snapshots, 0.04)).toBe(true);
  });

  it("detects forward split — large price drop between consecutive snapshots", () => {
    const snapshots = [
      makeSnapshot(100, hoursAfter(DETECTION_TIME, 12)),
      makeSnapshot(105, hoursAfter(DETECTION_TIME, 24)),
      // 10:1 forward split
      makeSnapshot(10.5, hoursAfter(DETECTION_TIME, 36)),
    ];
    expect(detectCorporateAction(snapshots, 95)).toBe(true);
  });

  it("handles unsorted snapshots correctly", () => {
    // Snapshots in reverse order — should still detect the jump
    const snapshots = [
      makeSnapshot(1.45, hoursAfter(DETECTION_TIME, 48)),
      makeSnapshot(1.50, hoursAfter(DETECTION_TIME, 36)),
      makeSnapshot(0.06, hoursAfter(DETECTION_TIME, 24)),
      makeSnapshot(0.05, hoursAfter(DETECTION_TIME, 12)),
    ];
    expect(detectCorporateAction(snapshots, 0.04)).toBe(true);
  });

  it("returns false when ratio is exactly at boundary (< 5x)", () => {
    // 4.9x jump — aggressive but not flagged
    const snapshots = [
      makeSnapshot(4.9, hoursAfter(DETECTION_TIME, 24)),
    ];
    expect(detectCorporateAction(snapshots, 1.0)).toBe(false);
  });

  it("returns true when ratio is exactly 5x", () => {
    const snapshots = [
      makeSnapshot(5.0, hoursAfter(DETECTION_TIME, 24)),
    ];
    expect(detectCorporateAction(snapshots, 1.0)).toBe(true);
  });
});
