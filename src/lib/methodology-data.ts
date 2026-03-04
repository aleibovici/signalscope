export type SourceStatus = "active" | "coming_soon" | "disabled";

export interface SignalSource {
  icon: string;
  name: string;
  description: string;
  params: string;
  status: SourceStatus;
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
    status: "active",
  },
  {
    icon: "🐦",
    name: "X / Twitter",
    description: "Keyword search for ticker mentions from the past 24 hours, run once daily before market open.",
    params: "X API v2 · 24 h lookback · up to 300 tweets/run",
    status: "active",
  },
  {
    icon: "📋",
    name: "SEC Insider",
    description: "C-suite open-market purchases of $50 K or more from OpenInsider and EDGAR.",
    params: "C-suite only · $50 K+ purchases · open market only",
    status: "active",
  },
  {
    icon: "📈",
    name: "Volume Spike",
    description: "Flags symbols whose volume is ≥2× their 10-day average.",
    params: "110 symbols · ≥2× 10-day avg · Yahoo Finance data",
    status: "active",
  },
  {
    icon: "💎",
    name: "Options Flow",
    description: "Unusual call volume, heavy OTM calls, and call sweeps.",
    params: "Unusual Whales · FlowAlgo",
    status: "coming_soon",
  },
  {
    icon: "📣",
    name: "StockTwits",
    description: "Trending tickers from StockTwits via TrendSpider mirror (server-side rendered, no Cloudflare block).",
    params: "TrendSpider mirror · trending symbols · price + day gain",
    status: "active",
  },
];

export const sourceWeights: SourceWeight[] = [
  { source: "SEC Insider", weight: "3.0" },
  { source: "Options Flow", weight: "2.5" },
  { source: "Volume Spike", weight: "2.0" },
  { source: "X / Twitter", weight: "1.2" },
  { source: "Reddit", weight: "1.0" },
];

export const scoringBands: ScoringBand[] = [
  { band: "80–100", meaning: "Real catalyst + multi-source + insider/options confirmation" },
  { band: "60–79", meaning: "Real catalyst + ≥2 sources, or strong insider/options alone" },
  { band: "40–59", meaning: "Social buzz with catalyst indicators (unconfirmed)" },
  { band: "20–39", meaning: "Social-only signal, no verifiable catalyst" },
  { band: "0–19", meaning: "Likely noise or pump attempt" },
];

export const pndFlags: PndFlag[] = [
  { flag: "penny_price", desc: "Price below $1 with no verifiable catalyst" },
  { flag: "otc_listing", desc: "Listed on OTC / Pink Sheets" },
  { flag: "micro_cap_no_catalyst", desc: "Market cap < $50 M with no news" },
  { flag: "only_penny_subs", desc: "Only in r/pennystocks or r/smallstreetbets" },
  { flag: "single_source", desc: "Only one signal source" },
  { flag: "hyperbolic_language", desc: '≥3 hype phrases ("moon", "100×", "can\'t lose"…)' },
  { flag: "coordinated_posts", desc: "≥50% near-identical post titles" },
  { flag: "no_news_catalyst", desc: "Multiple signals with no verifiable news" },
  { flag: "sudden_spike", desc: "≥3 Reddit signals all <3 h old AND avg upvotes <10" },
  { flag: "twitter_bot_promoters", desc: "Coordinated low-credibility accounts on X" },
  { flag: "twitter_coordinated_pump", desc: "≥3 tweets with ≥40% near-identical text" },
];

export const signalStages: SignalStage[] = [
  {
    stage: "EARLY",
    color: "bg-yellow-100 text-yellow-800",
    desc: "Score ≥40, multiple sources or novel ticker. Worth watching but needs confirmation.",
  },
  {
    stage: "FORMING",
    color: "bg-orange-100 text-orange-800",
    desc: "Score ≥45–50 with velocity or multi-source. Catalyst indicators present.",
  },
  {
    stage: "CONFIRMED",
    color: "bg-green-100 text-green-800",
    desc: "Score ≥65–70 with strong multi-source or insider/options backing.",
  },
  {
    stage: "FILTERED",
    color: "bg-red-100 text-red-800",
    desc: "Failed P&D check. Quarantined and visible in the Filtered tab.",
  },
];

export const recommendationLevels: RecommendationLevel[] = [
  {
    level: "Strong Buy",
    color: "bg-green-600 text-white",
    desc: "Real catalyst + insider/options + multi-source corroboration (rare).",
  },
  {
    level: "Buy",
    color: "bg-green-100 text-green-800",
    desc: "Real catalyst with ≥2 corroborating sources.",
  },
  {
    level: "Watch",
    color: "bg-yellow-100 text-yellow-800",
    desc: "Interesting signal that needs further confirmation before acting.",
  },
  {
    level: "Avoid",
    color: "bg-red-100 text-red-800",
    desc: "No verifiable catalyst, pure hype, or P&D risk indicators.",
  },
];

export const methodologyDescription =
  "SignalScope harvests ticker mentions from six signal sources, aggregates them by symbol, " +
  "scores each candidate with AI, runs an 11-flag pump-and-dump filter, and surfaces only " +
  "the tickers with the strongest multi-source backing and verifiable catalysts. The result " +
  "is a prioritised watchlist you can act on before the crowd.";

export const aggregationDescription =
  "Raw mentions are grouped by ticker symbol. A symbol becomes a candidate when it appears " +
  "≥2 times from a single source, appears in ≥2 different sources, or comes from a " +
  "high-value source (SEC Insider, Volume Spike, Options Flow) even as a single mention. " +
  "Each source carries a weight that biases the aggregate score.";

export const scoringDescription =
  "Each candidate is scored by AI using source weights, catalyst quality, novelty, and " +
  "cross-source corroboration. Pure social signals (Reddit / StockTwits / Twitter only) " +
  "are hard-capped at 50 — this is enforced programmatically regardless of what the AI " +
  "returns. Only tickers with a verifiable catalyst source (SEC Insider or Options Flow) " +
  "can score above 50. First-appearance tickers receive a +5–10 novelty boost; tickers " +
  "seen 3+ times or older than 7 days receive a staleness penalty.";

export const pndDescription =
  "Every candidate is checked against 11 statistical flags before scoring. A ticker that " +
  "triggers ≥3 flags is moved to FILTERED status and quarantined. Exactly " +
  "2 flags triggers an additional AI edge-case assessment.";

export const disclaimer =
  "SignalScope is for informational purposes only and does not constitute financial advice. " +
  "Always do your own research before making any investment decisions.";
