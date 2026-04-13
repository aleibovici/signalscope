export interface SignalSource {
  icon: string;
  name: string;
  description: string;
  params: string;
}

export interface SourceWeight {
  source: string;
  weight: string;
}

export interface ScoringBand {
  band: string;
  meaning: string;
}

export interface PndFlag {
  flag: string;
  desc: string;
}

export interface SignalStage {
  stage: string;
  color: string;
  desc: string;
}

export interface RecommendationLevel {
  level: string;
  color: string;
  desc: string;
}

export const pipelineSteps = ["Sources", "Aggregate", "Score", "Filter", "Validate"] as const;

export const signalSources: SignalSource[] = [
  {
    icon: "💬",
    name: "Reddit",
    description: "Monitors 17 investing subreddits for posts and high-engagement comments.",
    params: "Posts + comments · 17 subreddits · 1.5 s delay between requests",
  },
  {
    icon: "🐦",
    name: "X / Twitter",
    description: "Keyword search for ticker mentions from the past 24 hours, run once daily before market open.",
    params: "X API v2 · 24 h lookback · up to 300 tweets/run",
  },
  {
    icon: "📋",
    name: "SEC Insider",
    description: "C-suite open-market purchases of $50 K or more from OpenInsider and EDGAR.",
    params: "C-suite only · $50 K+ purchases · open market only",
  },
  {
    icon: "📈",
    name: "Volume Spike",
    description: "Flags symbols whose volume is ≥2× their 10-day average.",
    params: "89 symbols · ≥2× 10-day avg",
  },
  {
    icon: "💎",
    name: "Options Flow",
    description: "Detects unusual call volume, heavy OTM call activity, call sweeps, and net premium flow (call vs put dollar volume) across a watchlist of liquid stocks.",
    params: "89 symbols · Vol/OI ≥3× · OTM 10%+ · nearest expiry · net premium & call/put ratio",
  },
  {
    icon: "📣",
    name: "StockTwits",
    description: "Trending tickers from StockTwits for real-time retail sentiment and momentum.",
    params: "Trending symbols · price + day gain",
  },
  {
    icon: "🏛️",
    name: "Congress",
    description: "Congressional stock purchases from public STOCK Act disclosures. Cross-scan dedup prevents repeated ingestion of the same transaction.",
    params: "Buys only · US tickers · 7-day pub window · txId dedup",
  },
  {
    icon: "🔮",
    name: "Polymarket",
    description: "Active prediction markets for stock catalysts — price targets, earnings beats, merger closes, FDA approvals, and S&P 500 inclusions. Two-phase scan: known symbols first, then any tickers discovered by other sources.",
    params: "Public Gamma API · $5K total vol OR $1K 24h vol · event-level aggregation · two-phase scan",
  },
];

export const sourceWeights: SourceWeight[] = [
  { source: "SEC Insider", weight: "3.0" },
  { source: "Options Flow", weight: "2.5" },
  { source: "Congress", weight: "2.5" },
  { source: "Volume Spike", weight: "2.5" },
  { source: "X / Twitter", weight: "1.2" },
  { source: "SEC Filing", weight: "1.0" },
  { source: "Polymarket", weight: "2.0" },
  { source: "Reddit", weight: "1.0" },
  { source: "StockTwits", weight: "1.0" },
];

export const scoringBands: ScoringBand[] = [
  { band: "80–100", meaning: "Real catalyst + multi-source + insider/congress/options confirmation" },
  { band: "60–79", meaning: "Real catalyst + ≥2 sources, or strong insider/congress/options alone" },
  { band: "40–59", meaning: "Social buzz with catalyst indicators (unconfirmed)" },
  { band: "20–39", meaning: "Social-only signal, no verifiable catalyst" },
  { band: "0–19", meaning: "Likely noise or pump attempt" },
];

export const pndFlags: PndFlag[] = [
  // Effective flags — count toward PnD threshold (ML-validated bearish predictors)
  { flag: "micro_cap_no_catalyst", desc: "Market cap < $40 M with no news — strongest bearish flag (−4.7% avg 7d)" },
  { flag: "sudden_spike", desc: "≥3 Reddit signals all <3 h old AND avg upvotes <10 (−4.1% avg 7d)" },
  { flag: "no_news_catalyst", desc: "Multiple signals with no verifiable news — informational only (not significant in current dataset)" },
  { flag: "only_penny_subs", desc: "Only in r/pennystocks or r/smallstreetbets (−1.2% avg 7d)" },
  { flag: "sub_dime_52wk_floor", desc: "52-week low below $0.09 — shell/zombie stock risk" },
  { flag: "upvote_pump", desc: ">2000 upvotes with ≤3 posts and <30 comments — coordinated vote boosting" },
  { flag: "hyperbolic_language", desc: '≥3 hype phrases ("moon", "100×", "can\'t lose"…)' },
  { flag: "twitter_bot_promoters", desc: "Coordinated low-credibility accounts on X" },
  // Informational flags — detected but NOT counted toward threshold (ML shows neutral/positive returns)
  { flag: "penny_price", desc: "Price below $0.50 — informational only (ML: +1.4% avg 7d)" },
  { flag: "otc_listing", desc: "Listed on OTC / Pink Sheets — informational only (ML: +0.5% avg 7d)" },
  { flag: "single_source", desc: "Only one signal source — informational only (not significant in current dataset)" },
  { flag: "coordinated_posts", desc: "≥50% near-identical post titles — informational only (not significant in current dataset)" },
  { flag: "twitter_coordinated_pump", desc: "≥3 tweets with ≥40% near-identical text — informational only (not significant in current dataset)" },
];

export const signalStages: SignalStage[] = [
  {
    stage: "EARLY",
    color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    desc: "Score ≥40, multiple sources or novel ticker. Earliest detection point with highest alpha potential.",
  },
  {
    stage: "FORMING",
    color: "bg-yellow-100 text-yellow-800 dark:bg-amber-950/40 dark:text-amber-300",
    desc: "Score ≥45–50 with velocity or multi-source. Momentum is building but the move may have started.",
  },
  {
    stage: "CONFIRMED",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    desc: "Score ≥65–70 with broad, fresh social agreement or exchange-specific breakout patterns. Stale signals (median age ≥6 h) are excluded — the move may already be priced in.",
  },
  {
    stage: "FILTERED",
    color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    desc: "Failed P&D check. Quarantined and visible in the Filtered tab.",
  },
];

export const recommendationLevels: RecommendationLevel[] = [
  {
    level: "Strong Buy",
    color: "bg-green-600 text-white dark:bg-green-700 dark:text-white",
    desc: "Real catalyst + insider/options + multi-source corroboration (rare).",
  },
  {
    level: "Buy",
    color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    desc: "Real catalyst with ≥2 corroborating sources.",
  },
  {
    level: "Watch",
    color: "bg-yellow-100 text-yellow-800 dark:bg-amber-950/40 dark:text-amber-300",
    desc: "Interesting signal that needs further confirmation before acting.",
  },
  {
    level: "Avoid",
    color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    desc: "No verifiable catalyst, pure hype, or P&D risk indicators.",
  },
];

export const methodologyDescription =
  "SignalScope monitors public ticker mentions across eight signal sources — from social media and SEC filings " +
  "to congressional trades and Polymarket prediction markets — aggregates them by symbol, scores each candidate with AI, runs a " +
  "13-flag pump-and-dump filter, and validates signal quality against a Ridge+LightGBM per-horizon ensemble ML backtesting pipeline with EWMA features trained on historical breakout outcomes. " +
  "The result is a prioritised watchlist of tickers with the strongest multi-source backing, " +
  "verifiable catalysts, and machine-learning-confirmed signal patterns — surfaced before the crowd.";

export const aggregationDescription =
  "Raw mentions are grouped by ticker symbol. A symbol becomes a candidate when it appears " +
  "≥2 times from a single source, appears in ≥2 different sources, or comes from a " +
  "high-value source (SEC Insider, Congress, Volume Spike, Options Flow) even as a single mention. " +
  "Each source carries a weight that biases the aggregate score.";

export const scoringDescription =
  "Each candidate is scored by AI using source weights, catalyst quality, novelty, and " +
  "cross-source corroboration. Pure social signals (Reddit / StockTwits / Twitter only) " +
  "are hard-capped at 50 — this is enforced programmatically regardless of what the AI " +
  "returns. Only tickers with a verifiable catalyst source (SEC Insider or Congress) " +
  "can score above 50. First-appearance tickers receive a +5–10 novelty boost; tickers " +
  "seen 3+ times or older than 7 days receive a staleness penalty. Signal freshness is " +
  "also tracked — stale consensus (median signal age ≥6 h) is excluded from the highest stage. " +
  "This AI score reflects how strong the evidence is, not how much upside is left; Opportunity Score (see above) captures early-mover potential separately.";

export const pndDescription =
  "Every candidate is checked against 13 statistical flags before scoring. Flags are split into " +
  "effective flags (backed by ML as bearish predictors) and informational flags (detected but not " +
  "counted toward the threshold). A ticker that triggers ≥3 effective flags is moved to Filtered " +
  "status and quarantined. Exactly " +
  "2 flags triggers an additional AI edge-case assessment.";

export const backtestDescription =
  "SignalScope tracks the real-world performance of every signal it generates. Twice-daily price snapshots " +
  "measure nominal returns at 1, 3, 7, and 30 days after detection. Tickers that undergo corporate actions " +
  "(reverse splits, forward splits, mergers) during the tracking window are automatically detected via " +
  "consecutive-snapshot analysis and excluded from performance statistics. This growing dataset feeds into a " +
  "Ridge+LightGBM per-horizon ensemble with EWMA (exponentially weighted) historical features. Three RidgeCV models " +
  "predict 1-day, 3-day, and 7-day returns, blended with per-horizon LightGBM models using optimized weights — " +
  "including a contrarian 7-day component that converts inverted high-volatility predictions into positive signal. " +
  "The model analyzes 293 features per ticker " +
  "including cross-sectional ranks, P&D flag history, and autocorrelation patterns. Feature importance analysis " +
  "identifies which factors drive accuracy. These insights are used to continuously refine AI score thresholds, " +
  "stage assignments, and pump-and-dump detection — so the platform gets smarter with every scan.";

export const backtestPipeline = [
  "Price snapshots (open & close)",
  "Return computation (1d, 3d, 7d, 30d)",
  "Feature engineering (293 features, EWMA + cross-sectional)",
  "Per-horizon Ridge+LightGBM training + importance analysis",
  "Optimized ensemble blending (contrarian 7d) + threshold optimization",
] as const;

export const disclaimer =
  "SignalScope is for informational purposes only and does not constitute financial advice. " +
  "Always do your own research before making any investment decisions.";
