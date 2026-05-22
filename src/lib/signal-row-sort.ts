import type { ValidatedTickerData } from "@/hooks/use-scans";

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

export function defaultSortDir(key: SignalRowSortKey): SignalRowSortDir {
  return key === "symbol" ? "asc" : "desc";
}

function returnField(period: string): keyof ValidatedTickerData {
  switch (period) {
    case "1d":
      return "return1d";
    case "3d":
      return "return3d";
    case "14d":
      return "return14d";
    case "30d":
      return "return30d";
    case "7d":
    default:
      return "return7d";
  }
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
  returnPeriod = "7d",
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
      const field = returnField(returnPeriod);
      cmp = numVal(a[field] as number | null | undefined) - numVal(b[field] as number | null | undefined);
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
    returnPeriod?: string;
    bookmarkedSymbols?: Set<string>;
  },
): ValidatedTickerData[] {
  const returnPeriod = options?.returnPeriod ?? "7d";
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

export const SIGNAL_ROW_SORT_KEY = "signalscope_row_sort";

export function loadRowSort(): { key: SignalRowSortKey | null; dir: SignalRowSortDir } {
  try {
    const raw = localStorage.getItem(SIGNAL_ROW_SORT_KEY);
    if (!raw) return { key: null, dir: "desc" };
    const parsed = JSON.parse(raw) as { key?: SignalRowSortKey | null; dir?: SignalRowSortDir };
    return { key: parsed.key ?? null, dir: parsed.dir ?? "desc" };
  } catch {
    return { key: null, dir: "desc" };
  }
}

export function saveRowSort(key: SignalRowSortKey | null, dir: SignalRowSortDir) {
  try {
    localStorage.setItem(SIGNAL_ROW_SORT_KEY, JSON.stringify({ key, dir }));
  } catch {
    /* ignore */
  }
}
