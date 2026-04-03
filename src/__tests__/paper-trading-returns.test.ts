import { describe, expect, it } from "vitest";
import {
  closingSnapshotDate,
  computePaperTradeMark,
  pickClosedExit,
  pickOpenMtm,
  type PerfReturnFields,
} from "@/lib/paper-trading-returns";

function basePerf(over: Partial<PerfReturnFields> = {}): PerfReturnFields {
  return {
    return1d: null,
    price1d: null,
    return3d: null,
    price3d: null,
    return7d: null,
    price7d: null,
    return30d: null,
    price30d: null,
    ...over,
  };
}

describe("computePaperTradeMark", () => {
  it("CLOSED uses 7d return, not 30d, when both exist", () => {
    const r = basePerf({
      return7d: 0.1,
      price7d: 11,
      return30d: 0.5,
      price30d: 15,
    });
    const m = computePaperTradeMark(r, 40);
    expect(m.status).toBe("CLOSED");
    expect(m.returnPct).toBe(0.1);
    expect(m.holdDays).toBe("7d");
  });

  it("CLOSED with only 30d data has no mark (we do not hold past 7d for P&L)", () => {
    const r = basePerf({
      return30d: 0.08,
      price30d: 10.8,
    });
    const m = computePaperTradeMark(r, 40);
    expect(m.status).toBe("CLOSED");
    expect(m.returnPct).toBeNull();
    expect(m.holdDays).toBeNull();
  });

  it("OPEN uses longest horizon up to 7d (3d over 1d)", () => {
    const r = basePerf({
      return1d: 0.02,
      price1d: 10.2,
      return3d: 0.05,
      price3d: 10.5,
    });
    const m = computePaperTradeMark(r, 4);
    expect(m.status).toBe("OPEN");
    expect(m.returnPct).toBe(0.05);
    expect(m.holdDays).toBe("3d");
  });

  it("CLOSED falls back to 3d then 1d when 7d missing", () => {
    const r = basePerf({
      return3d: 0.04,
      price3d: 10.4,
    });
    const m = computePaperTradeMark(r, 10);
    expect(m.status).toBe("CLOSED");
    expect(m.returnPct).toBe(0.04);
    expect(m.holdDays).toBe("3d");
  });

  it("total P&L equals positionSize times sum of returns (same as mean × n × size)", () => {
    const positionSize = 1000;
    const trades = [
      computePaperTradeMark(
        basePerf({ return7d: 0.1, price7d: 11 }),
        10,
      ),
      computePaperTradeMark(
        basePerf({ return7d: -0.05, price7d: 9.5 }),
        10,
      ),
    ];
    const withRet = trades.filter((t) => t.returnPct !== null);
    const totalPnl = withRet.reduce((s, t) => s + positionSize * (t.returnPct ?? 0), 0);
    const avg =
      withRet.length > 0
        ? withRet.reduce((s, t) => s + (t.returnPct ?? 0), 0) / withRet.length
        : 0;
    expect(totalPnl).toBeCloseTo(positionSize * withRet.length * avg, 10);
  });
});

describe("pickClosedExit", () => {
  it("ignores 30d even when it is larger", () => {
    const r = basePerf({
      return7d: 0.05,
      price7d: 10.5,
      return30d: 0.9,
      price30d: 19,
    });
    const p = pickClosedExit(r, 40);
    expect(p?.holdDays).toBe("7d");
    expect(p?.returnPct).toBe(0.05);
  });
});

describe("closingSnapshotDate", () => {
  it("returns the snapped timestamp for the hold label", () => {
    const t7 = new Date("2026-03-20T16:00:00Z");
    const d = closingSnapshotDate(
      {
        snapped1dAt: new Date("2026-03-15T16:00:00Z"),
        snapped3dAt: null,
        snapped7dAt: t7,
        snapped30dAt: null,
      },
      "7d",
    );
    expect(d?.getTime()).toBe(t7.getTime());
  });
});

describe("pickOpenMtm", () => {
  it("never uses 30d — prefers 7d when age and data allow", () => {
    const r = basePerf({
      return7d: 0.05,
      price7d: 10.5,
      return30d: 0.2,
      price30d: 12,
    });
    const p = pickOpenMtm(r, 6);
    expect(p?.holdDays).toBe("7d");
    expect(p?.returnPct).toBe(0.05);
  });
});
