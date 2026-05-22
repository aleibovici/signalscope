import type { ValidatedTickerData } from "@/hooks/use-scans";
import { returnFieldForPeriod, type ReturnPeriod, DEFAULT_RETURN_PERIOD } from "@/lib/return-period";

export type SignalRowSortKey =
  | "symbol"
  | "recommendation"
  | "stage"
  | "sources"
  | "aiScore"
  | "opportunityScore"
  | "signalCount"
  | "price"
  | "return"
  | "netPremium";

export type SignalRowSortDir = "asc" | "desc";

const REC_RANK: Record<string, number> = {
  "Strong Buy": 4,
  Buy: 3,
  Watch: 2,
  Avoid: 1,
};

const STAGE_RANK: Record<string, number> = {
  Emerging: 3,
  Building: 2,
  Consensus: 1,
  Filtered: 0,
  Unscored: 0,
};

export const LEGACY_ROW_SORT_KEY = "signalscope_row_sort";
export const DASHBOARD_ROW_SORT_KEY = "signalscope_row_sort_dashboard";

export function defaultSortDir(key: SignalRowSortKey): SignalRowSortDir {
  return key === "symbol" ? "asc" : "desc";
}

function numVal(value: number | null | undefined): number {
  return value ?? -Infinity;
}

function strVal(value: string | null | undefined): string {
  return value ?? "";
}

/** Compare two tickers for column sort (ascending). */
export function compareTickers(
  a: ValidatedTickerData,
  b: ValidatedTickerData,
  key: SignalRowSortKey,
  returnPeriod: ReturnPeriod = DEFAULT_RETURN_PERIOD,
): number {
  let cmp = 0;
  switch (key) {
    case "symbol":
      cmp = strVal(a.symbol).localeCompare(strVal(b.symbol));
      break;
    case "recommendation":
      cmp = (REC_RANK[a.recommendation ?? ""] ?? 0) - (REC_RANK[b.recommendation ?? ""] ?? 0);
      break;
    case "stage":
      cmp = (STAGE_RANK[a.stage] ?? 0) - (STAGE_RANK[b.stage] ?? 0);
      break;
    case "sources":
      cmp = a.sourceCount - b.sourceCount;
      break;
    case "aiScore":
      cmp = a.aiScore - b.aiScore;
      break;
    case "opportunityScore":
      cmp = a.opportunityScore - b.opportunityScore;
      break;
    case "signalCount":
      cmp = a.signalCount - b.signalCount;
      break;
    case "price":
      cmp = numVal(a.price) - numVal(b.price);
      break;
    case "return": {
      const field = returnFieldForPeriod(returnPeriod);
      cmp = numVal(a[field]) - numVal(b[field]);
      break;
    }
    case "netPremium":
      cmp = numVal(a.netPremium) - numVal(b.netPremium);
      break;
  }
  if (cmp === 0) cmp = strVal(a.symbol).localeCompare(strVal(b.symbol));
  return cmp;
}

export function sortTickers(
  tickers: ValidatedTickerData[],
  sortKey: SignalRowSortKey | null,
  sortDir: SignalRowSortDir,
  options?: {
    returnPeriod?: ReturnPeriod;
    bookmarkedSymbols?: Set<string>;
  },
): ValidatedTickerData[] {
  const returnPeriod = options?.returnPeriod ?? DEFAULT_RETURN_PERIOD;
  const bookmarkedSymbols = options?.bookmarkedSymbols;

  if (!sortKey) {
    if (!bookmarkedSymbols || bookmarkedSymbols.size === 0) return tickers;
    return [...tickers].sort((a, b) => {
      const aB = bookmarkedSymbols.has(a.symbol) ? 0 : 1;
      const bB = bookmarkedSymbols.has(b.symbol) ? 0 : 1;
      return aB - bB;
    });
  }

  const mult = sortDir === "asc" ? 1 : -1;
  return [...tickers].sort(
    (a, b) => mult * compareTickers(a, b, sortKey, returnPeriod),
  );
}

export function loadRowSort(storageKey: string = DASHBOARD_ROW_SORT_KEY): {
  key: SignalRowSortKey | null;
  dir: SignalRowSortDir;
} {
  try {
    let raw = localStorage.getItem(storageKey);
    if (!raw && storageKey === DASHBOARD_ROW_SORT_KEY) {
      raw = localStorage.getItem(LEGACY_ROW_SORT_KEY);
    }
    if (!raw) return { key: null, dir: "desc" };
    const parsed = JSON.parse(raw) as { key?: SignalRowSortKey | null; dir?: SignalRowSortDir };
    return { key: parsed.key ?? null, dir: parsed.dir ?? "desc" };
  } catch {
    return { key: null, dir: "desc" };
  }
}

export function saveRowSort(
  storageKey: string,
  key: SignalRowSortKey | null,
  dir: SignalRowSortDir,
) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ key, dir }));
  } catch {
    /* ignore */
  }
}
