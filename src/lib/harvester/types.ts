export type Source = "REDDIT" | "STOCKTWITS" | "SEC_INSIDER" | "SEC_FILING" | "OPTIONS_FLOW" | "VOLUME_SPIKE" | "TWITTER" | "CONGRESS";

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
  sortType?: string;        // "new" | "rising" | "hot" — needed for velocity weighting
  flair?: string;            // Reddit post flair (DD, News, Meme, etc.) — used for velocity weighting
  watchlistCount?: number;  // StockTwits watchlist count
  insiderTitle?: string;    // insider's role (CEO, CFO, Director, etc.)
  purchaseValue?: number;   // dollar value of insider purchase
  optionType?: string;      // "Call" | "Put"
  optionVolume?: number;    // total option volume
  openInterest?: number;    // open interest
  volOiRatio?: number;      // volume / open interest ratio
  volumeRatio?: number;     // current volume / 10-day avg volume
  // X/Twitter-specific fields
  retweetCount?: number;
  likeCount?: number;
  replyCount?: number;
  quoteCount?: number;
  followerCount?: number;
  isVerified?: boolean;
  tweetType?: string;       // "cashtag" | "keyword"
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
  wk52Lo?: number | null;
  wk52Hi?: number | null;
  name?: string;
  sector?: string;
  exchange?: string;
  earningsDate?: string;
  floatShares?: number | null;
  sharesOutstanding?: number | null;
}

export type SignalType = "insider_buy" | "options_flow" | "congress_buy" | "multi_source" | "reddit_velocity" | "twitter_velocity";

export interface AiScoreResult {
  symbol: string;
  score: number;
  rawScore: number;
  sentiment: string;
  reasoning: string;
}

export interface PndAiResult {
  flagged: boolean;
  confidence?: number;
  reasoning?: string;
}

export interface TradeSetup {
  entryLo: number;
  entryHi: number;
  stopLoss: number;
  target1: number;
  target2: number;
  timeframe: string;
  riskReward: string;
  confidence: "Low" | "Medium" | "High";
}

export interface TickerReport {
  catalyst: string;
  risks: string;
  recommendation: string;
  report: string;
  tradeSetup?: TradeSetup;
}

export interface NoveltyContext {
  firstSeenAt: Date | null;
  daysSinceFirstSeen: number | null;
  priorAppearances: number;
  isNovel: boolean;
}

export interface MomentumBreakdown {
  risingCount: number;
  freshCount: number;       // postAge < 3h
  recentCount: number;      // postAge 3-12h
  commentDerivedCount: number;
  staleCount: number;       // postAge > 12h
}

export interface HarvestIngestPayload {
  signals: RawSignal[];
  harvestedAt: string; // ISO timestamp
}

export interface AggregatedSymbol {
  symbol: string;
  signals: RawSignal[];
  sourceCount: number;
  weightedSourceScore: number;
  subredditCount: number;
  totalUpvotes: number;
  totalComments: number;
  avgVelocity: number;
  momentum: MomentumBreakdown;
  medianSignalAgeHrs: number | null; // median postAge across social signals (hours)
}
