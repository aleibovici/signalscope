/** Display labels for ticker stages. DB enum values stay unchanged. */
export const STAGE_LABELS: Record<string, string> = {
  EARLY: "Emerging",
  FORMING: "Building",
  CONFIRMED: "Consensus",
  FILTERED: "Filtered",
  UNSCORED: "Unscored",
};

/** Reverse map: display name (case-insensitive) → DB enum value */
const DISPLAY_TO_DB: Record<string, string> = {
  EMERGING: "EARLY",
  BUILDING: "FORMING",
  CONSENSUS: "CONFIRMED",
  // Also accept DB values directly
  EARLY: "EARLY",
  FORMING: "FORMING",
  CONFIRMED: "CONFIRMED",
  FILTERED: "FILTERED",
  UNSCORED: "UNSCORED",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

/** Convert a display stage name (or DB value) to DB enum value. Returns undefined if invalid. */
export function stageToDb(input: string): "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" | "UNSCORED" | undefined {
  return DISPLAY_TO_DB[input.toUpperCase()] as "EARLY" | "FORMING" | "CONFIRMED" | "FILTERED" | "UNSCORED" | undefined;
}

/** Valid stage values accepted as API input (display names). */
export const API_STAGE_VALUES = ["Emerging", "Building", "Consensus"] as const;
