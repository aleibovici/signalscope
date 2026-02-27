export type Source = "REDDIT" | "STOCKTWITS" | "SEC_INSIDER" | "OPTIONS_FLOW" | "VOLUME_SPIKE";

export interface RawSignal {
  symbol: string;
  source: Source;
  title?: string;
  body?: string;
  url?: string;
  author?: string;
  authorAge?: number;
  authorKarma?: number;
  upvotes?: number;
  commentCount?: number;
  subreddit?: string;
  postAge?: number;         // hours since post creation
  sortType?: string;        // "new" | "rising" — needed for velocity weighting
  watchlistCount?: number;  // StockTwits watchlist count
  insiderTitle?: string;    // insider's role (CEO, CFO, Director, etc.)
  purchaseValue?: number;   // dollar value of insider purchase
  optionType?: string;      // "Call" | "Put"
  optionVolume?: number;    // total option volume
  openInterest?: number;    // open interest
  volOiRatio?: number;      // volume / open interest ratio
  volumeRatio?: number;     // current volume / 10-day avg volume
}

export interface ScoredSignal extends RawSignal {
  velocityScore: number;
  sentiment?: string;
}

export interface PndResult {
  flagged: boolean;
  flags: string[];
  score: number;
}

export interface FundamentalData {
  price: number | null;
  marketCap: number | null;
  shortFloat: number | null;
  fiftyTwoWeekRange?: string;
  name?: string;
  sector?: string;
  exchange?: string;
}

export type SignalType = "insider_buy" | "options_flow" | "multi_source" | "reddit_velocity";

export interface AiScoreResult {
  symbol: string;
  score: number;
  sentiment: string;
  reasoning: string;
}

export interface TickerReport {
  catalyst: string;
  risks: string;
  recommendation: string;
  report: string;
}

export interface AggregatedSymbol {
  symbol: string;
  signals: RawSignal[];
  sourceCount: number;
  subredditCount: number;
  totalUpvotes: number;
  totalComments: number;
  avgVelocity: number;
}
