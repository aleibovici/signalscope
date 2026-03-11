/** Display labels for ticker stages. DB enum values stay unchanged. */
export const STAGE_LABELS: Record<string, string> = {
  EARLY: "Emerging",
  FORMING: "Building",
  CONFIRMED: "Consensus",
  FILTERED: "Filtered",
  UNSCORED: "Unscored",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
