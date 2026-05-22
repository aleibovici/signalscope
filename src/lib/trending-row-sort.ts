import type { TrendingFilters } from "@/hooks/use-trending";
import type { SignalRowSortKey } from "@/lib/signal-row-sort";

/** Row columns that map to the trending API sortBy param (server-side, paginated). */
export const TRENDING_API_SORT_KEYS = new Set<SignalRowSortKey>([
  "aiScore",
  "opportunityScore",
  "price",
  "return",
]);

const ROW_TO_API: Partial<Record<SignalRowSortKey, NonNullable<TrendingFilters["sortBy"]>>> = {
  aiScore: "aiScore",
  opportunityScore: "opportunityScore",
  price: "price",
  return: "return",
};

const API_TO_ROW: Partial<Record<NonNullable<TrendingFilters["sortBy"]>, SignalRowSortKey>> = {
  aiScore: "aiScore",
  opportunityScore: "opportunityScore",
  price: "price",
  return: "return",
};

export function trendingRowSortKey(filters: TrendingFilters): SignalRowSortKey | null {
  if (!filters.sortBy) return null;
  return API_TO_ROW[filters.sortBy] ?? null;
}

export function trendingFiltersForRowSort(key: SignalRowSortKey): Partial<TrendingFilters> | null {
  const sortBy = ROW_TO_API[key];
  if (!sortBy) return null;
  return { sortBy };
}

export function isTrendingApiSortKey(key: SignalRowSortKey): boolean {
  return TRENDING_API_SORT_KEYS.has(key);
}
