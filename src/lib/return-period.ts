import type { ValidatedTickerData } from "@/hooks/use-scans";

/** Selectable return windows (1d excluded — too short for trending). */
export type ReturnPeriod = "3d" | "7d" | "14d" | "30d";

export const RETURN_PERIODS: readonly { value: ReturnPeriod; label: ReturnPeriod }[] = [
  { value: "3d", label: "3d" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
];

export const DEFAULT_RETURN_PERIOD: ReturnPeriod = "7d";

type ReturnField = "return3d" | "return7d" | "return14d" | "return30d";

const PERIOD_TO_FIELD: Record<ReturnPeriod, ReturnField> = {
  "3d": "return3d",
  "7d": "return7d",
  "14d": "return14d",
  "30d": "return30d",
};

export function returnFieldForPeriod(period: ReturnPeriod): ReturnField {
  return PERIOD_TO_FIELD[period];
}

export function getReturnValue(
  ticker: ValidatedTickerData,
  period: ReturnPeriod = DEFAULT_RETURN_PERIOD,
): number | null | undefined {
  return ticker[returnFieldForPeriod(period)] ?? null;
}

export function returnTooltip(period: ReturnPeriod): string {
  return `Price change since detection (${period} window) from scan snapshot bars.`;
}
