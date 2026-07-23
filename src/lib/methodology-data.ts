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
  { flag: "only_penny_subs", desc: "Only in r/pennystocks or r/smallstreetbets (−1.2% avg 7d)" },
  { flag: "sub_dime_52wk_floor", desc: "52-week low below $0.09 — shell/zombie stock risk" },
  { flag: "upvote_pump", desc: ">2000 upvotes with ≤3 posts and <30 comments — coordinated vote boosting" },
  { flag: "hyperbolic_language", desc: '≥3 hype phrases ("moon", "100×", "can\'t lose"…)' },
  { flag: "twitter_bot_promoters", desc: "Coordinated low-credibility accounts on X" },
  // Informational flags — detected but NOT counted toward threshold (ML shows neutral/positive returns)
  { flag: "no_news_catalyst", desc: "Multiple signals with no verifiable news — informational only (not significant in current dataset)" },
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
    desc: "Building stage below the large-cap tier with a verifiable catalyst (insider buy, congressional trade, or unusual options flow), two or more corroborating sources, and AI score 60+. The 'caught it while it's still emerging and the smart-money signal is real' zone — the calibration sample over the last 90 days hit a 65% positive 7-day rate at +2.2% mean return.",
  },
  {
    level: "Buy",
    color: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    desc: "One of three paths, all below the large-cap tier: Emerging or Building stage with a verifiable catalyst, two or more sources, and AI score 55+ (calibration: +2.5% mean 7-day, 63% hit rate); Building stage with two or more sources and AI score 60+ (calibration: +1.6% / 60% hit); or Consensus stage with AI score 60+ but only when signals are still fresh (median age ≤ 6h, calibration: +2.4% / 61% hit). Consensus is capped at Buy because by the time a ticker reaches consensus the move is largely played out.",
  },
  {
    level: "Watch",
    color: "bg-yellow-100 text-yellow-800 dark:bg-amber-950/40 dark:text-amber-300",
    desc: "Interesting signal that does not (yet) meet the Buy thresholds. Includes all Emerging-stage tickers without a multi-source catalyst — calibration showed high-AI-score Emerging signals actually underperform baseline, so we surface them on the dashboard but do not label them Buy. The default label — most signals start here.",
  },
  {
    level: "Avoid",
    color: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    desc: "Flagged by the pump-and-dump filter, price under $0.12, or Filtered stage. Each path showed sub-baseline hit rates in calibration — low scores alone fall through to Watch rather than overstate confidence with Avoid.",
  },
];

export const methodologyDescription =
  "SignalScope monitors public ticker mentions across eight signal sources — from social media and SEC filings " +
  "to congressional trades and Polymarket prediction markets — aggregates them by symbol, scores each candidate with AI, runs a " +
  "13-flag pump-and-dump filter, and validates signal quality against a LightGBM ML backtesting pipeline trained on historical breakout outcomes across 308 engineered features. " +
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
  "returns. Only tickers with a verifiable catalyst source (SEC Insider, Congress, or Options Flow) " +
  "can score above 50. First-appearance tickers receive a +5–10 novelty boost; tickers " +
  "seen 3+ times or older than 7 days receive a staleness penalty. Signal freshness is " +
  "also tracked — stale consensus (median signal age ≥6 h) is excluded from the highest stage. " +
  "This AI score reflects how strong the evidence is, not how much upside is left; Opportunity Score (see above) captures early-mover potential separately. " +
  "The final recommendation label (Strong Buy / Buy / Watch / Avoid) is then derived from a deterministic rule over the score, stage, source mix, catalyst presence, market-cap tier, and pump-and-dump flags — the AI writes the narrative but does not choose the label, eliminating drift between the score and the recommendation.";

export const pndDescription =
  "Every candidate is checked against 13 statistical flags before scoring. Flags are split into " +
  "effective flags (backed by ML as bearish predictors) and informational flags (detected but not " +
  "counted toward the threshold). A ticker that triggers ≥3 effective flags is moved to Filtered " +
  "status and quarantined. Exactly " +
  "2 flags triggers an additional AI edge-case assessment.";

export const backtestDescription =
  "SignalScope tracks the real-world performance of every signal it generates. Three daily price snapshots " +
  "(9:45 AM, 12:30 PM, and 4:05 PM ET) measure nominal returns at 1, 3, 7, 14, and 30 days after detection. Tickers that undergo corporate actions " +
  "(reverse splits, forward splits, mergers) during the tracking window are automatically detected via " +
  "consecutive-snapshot analysis and excluded from performance statistics. This growing dataset trains a single " +
  "LightGBM regression model (depth 2, 40 estimators) on 3-day forward returns across 308 engineered features — " +
  "EWMA historical cross-products, P&D flag history, short-float and float-size interactions, and scan-level " +
  "aggregates. Only about 13 features carry non-zero importance; the dominant predictor is the average signal " +
  "strength across the scan, followed by the log of the interaction between a ticker's prior P&D reputation and " +
  "its current P&D flag count, then scan size, log market cap, and the prior P&D × scan size interaction. " +
  "The model is evaluated on 1-, 3-, and 7-day horizons; " +
  "feature importance analysis identifies which factors drive accuracy and feeds back into AI score thresholds, " +
  "stage assignments, and pump-and-dump detection — so the platform gets smarter with every scan.";

export const backtestPipeline = [
  "Price snapshots (open & close)",
  "Return computation (1d, 3d, 7d, 14d, 30d)",
  "Feature engineering (308 features, EWMA cross-products)",
  "LightGBM training on 3d returns + importance analysis",
  "Multi-horizon evaluation + threshold optimization",
] as const;

export const disclaimer =
  "SignalScope is for informational purposes only and does not constitute financial advice. " +
  "Always do your own research before making any investment decisions.";
