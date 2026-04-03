/* 7d-hold paper model: returns from 7d→3d→1d snapshots; decimals (0.05 = +5%). */

export type PerfReturnFields = {
  return1d: number | null;
  price1d: number | null;
  return3d: number | null;
  price3d: number | null;
  return7d: number | null;
  price7d: number | null;
  return30d: number | null;
  price30d: number | null;
};

export const HORIZON_MIN_AGE_DAYS: Record<"1d" | "3d" | "7d" | "30d", number> = {
  "1d": 18 / 24,
  "3d": 54 / 24,
  "7d": 120 / 24,
  "30d": 600 / 24,
};

type Horizon = keyof typeof HORIZON_MIN_AGE_DAYS;

export function pickHorizon(
  r: PerfReturnFields,
  order: Horizon[],
  ageDays: number,
): { currentPrice: number; returnPct: number; holdDays: string } | null {
  for (const h of order) {
    if (ageDays + 1e-9 < HORIZON_MIN_AGE_DAYS[h]) continue;
    const retKey = `return${h}` as keyof PerfReturnFields;
    const priceKey = `price${h}` as keyof PerfReturnFields;
    const ret = r[retKey];
    const price = r[priceKey];
    if (typeof ret === "number" && typeof price === "number") {
      return { currentPrice: price, returnPct: ret, holdDays: h };
    }
  }
  return null;
}

export function pickOpenMtm(r: PerfReturnFields, ageDays: number) {
  return pickHorizon(r, ["7d", "3d", "1d"], ageDays);
}

export function pickClosedExit(r: PerfReturnFields, ageDays: number) {
  return pickHorizon(r, ["7d", "3d", "1d"], ageDays);
}

export function computePaperTradeMark(r: PerfReturnFields, ageDays: number) {
  const status: "OPEN" | "CLOSED" = ageDays >= 7 ? "CLOSED" : "OPEN";
  const mark = pickOpenMtm(r, ageDays);

  return {
    status,
    currentPrice: mark?.currentPrice ?? null,
    returnPct: mark?.returnPct ?? null,
    holdDays: mark?.holdDays ?? null,
  };
}

export function closingSnapshotDate(
  r: {
    snapped1dAt: Date | null;
    snapped3dAt: Date | null;
    snapped7dAt: Date | null;
    snapped30dAt: Date | null;
  },
  holdDays: string | null,
): Date | null {
  switch (holdDays) {
    case "1d":
      return r.snapped1dAt;
    case "3d":
      return r.snapped3dAt;
    case "7d":
      return r.snapped7dAt;
    case "30d":
      return r.snapped30dAt;
    default:
      return null;
  }
}
