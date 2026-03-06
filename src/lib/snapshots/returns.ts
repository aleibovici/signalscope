/**
 * Computes return values from a time-series of price snapshots.
 *
 * For each target period (1d, 3d, 7d, 30d), finds the snapshot closest to
 * that many days after detection. Uses a tolerance window to account for
 * weekends and holidays. Always picks the closest snapshot to the target time.
 *
 * Returns are computed as: (snapshotPrice - detectionPrice) / detectionPrice
 */

interface Snapshot {
  price: number;
  createdAt: Date;
}

interface IntervalTarget {
  field: "1d" | "3d" | "7d" | "30d";
  targetHours: number;
  /** Minimum age (hours after detection) for a snapshot to qualify */
  minHours: number;
  /** Maximum age (hours after detection) for a snapshot to qualify */
  maxHours: number;
}

// Tolerance windows account for weekends/holidays
// e.g., for 1d: any snapshot between 18h and 48h after detection qualifies
const INTERVAL_TARGETS: IntervalTarget[] = [
  { field: "1d", targetHours: 24, minHours: 18, maxHours: 48 },
  { field: "3d", targetHours: 72, minHours: 54, maxHours: 120 },
  { field: "7d", targetHours: 168, minHours: 120, maxHours: 264 },
  { field: "30d", targetHours: 720, minHours: 600, maxHours: 888 },
];

export interface ComputedReturns {
  price1d: number | null;
  return1d: number | null;
  snapped1dAt: Date | null;
  price3d: number | null;
  return3d: number | null;
  snapped3dAt: Date | null;
  price7d: number | null;
  return7d: number | null;
  snapped7dAt: Date | null;
  price30d: number | null;
  return30d: number | null;
  snapped30dAt: Date | null;
}

export function computeReturnsFromSnapshots(
  snapshots: Snapshot[],
  detectionPrice: number,
  detectedAt: Date,
  _now?: Date
): ComputedReturns {
  const result: ComputedReturns = {
    price1d: null, return1d: null, snapped1dAt: null,
    price3d: null, return3d: null, snapped3dAt: null,
    price7d: null, return7d: null, snapped7dAt: null,
    price30d: null, return30d: null, snapped30dAt: null,
  };

  if (snapshots.length === 0 || detectionPrice <= 0) return result;

  const detectionMs = detectedAt.getTime();

  for (const target of INTERVAL_TARGETS) {
    const targetMs = detectionMs + target.targetHours * 60 * 60 * 1000;
    const minMs = detectionMs + target.minHours * 60 * 60 * 1000;
    const maxMs = detectionMs + target.maxHours * 60 * 60 * 1000;

    // Find the snapshot closest to targetMs within the [minMs, maxMs] window
    let bestSnapshot: Snapshot | null = null;
    let bestDistance = Infinity;

    for (const snap of snapshots) {
      const snapMs = snap.createdAt.getTime();
      if (snapMs < minMs || snapMs > maxMs) continue;

      const distance = Math.abs(snapMs - targetMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSnapshot = snap;
      }
    }

    if (bestSnapshot) {
      const r = result as unknown as Record<string, number | Date | null>;
      r[`price${target.field}`] = bestSnapshot.price;
      r[`return${target.field}`] = (bestSnapshot.price - detectionPrice) / detectionPrice;
      const suffix = target.field.charAt(0).toUpperCase() + target.field.slice(1);
      r[`snapped${suffix}At`] = bestSnapshot.createdAt;
    }
  }

  return result;
}

export { INTERVAL_TARGETS };
