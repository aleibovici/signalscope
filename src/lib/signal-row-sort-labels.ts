import type { SignalRowSortKey } from "@/lib/signal-row-sort";

export const SIGNAL_ROW_SORT_LABELS: Record<SignalRowSortKey, string> = {
  symbol: "ticker symbol",
  recommendation: "recommendation",
  stage: "stage",
  sources: "source count",
  aiScore: "AI score",
  opportunityScore: "opportunity rank",
  signalCount: "signal count",
  price: "price",
  return: "return",
  netPremium: "options flow",
};

export function sortButtonAriaLabel(
  key: SignalRowSortKey,
  isActive: boolean,
  sortDir: "asc" | "desc",
): string {
  const label = SIGNAL_ROW_SORT_LABELS[key];
  if (!isActive) return `Sort by ${label}`;
  return `Sort by ${label}, currently sorted ${sortDir === "asc" ? "ascending" : "descending"}`;
}
