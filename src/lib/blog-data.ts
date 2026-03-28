export interface BlogSection {
  heading?: string;
  body: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingTime: string;
  tags: string[];
  sections: BlogSection[];
}

const blogPostsUnsorted: BlogPost[] = [
  {
    slug: "how-breakout-signals-work",
    title: "How Breakout Signals Work: Multi-Source Stock Monitoring Explained",
    description:
      "Learn how monitoring multiple data sources — from social media to SEC filings — catches stock breakouts before they become mainstream news.",
    date: "2026-03-15",
    readingTime: "6 min read",
    tags: ["signals", "methodology", "getting-started"],
    sections: [
      {
        body: "Every major stock breakout starts somewhere. A Reddit post gains traction. An SEC insider filing hits EDGAR. A congressman discloses a purchase. Volume spikes without obvious news. By the time CNBC covers it, the move is well underway. The question for active traders and researchers has always been: how do you catch these early signals before they converge into consensus?",
      },
      {
        heading: "The problem with single-source monitoring",
        body: "Watching one channel — say, r/wallstreetbets — gives you noise. Lots of noise. Thousands of ticker mentions per day, most of which lead nowhere. Meme stocks, pump-and-dump attempts, and wishful thinking dominate the feed. The signal-to-noise ratio is terrible. But here is the key insight: when the same ticker appears independently across multiple unrelated sources, the probability of a real catalyst rises dramatically. A Reddit post about ACME coinciding with a congressional purchase of ACME and a volume spike in ACME tells a very different story than a Reddit post alone.",
      },
      {
        heading: "Seven sources, one pipeline",
        body: "SignalScope monitors seven distinct data feeds on every scan: Reddit (17 investing subreddits), X/Twitter (via API v2 keyword search), StockTwits (trending tickers), SEC insider filings (C-suite purchases over $50K from OpenInsider and EDGAR), congressional stock trades (STOCK Act disclosures), options flow (unusual call volume, OTM activity, call sweeps), and volume spikes (stocks trading at 2x+ their 10-day average). Each source carries a different weight reflecting its historical predictive value. SEC insider purchases carry 3x weight because corporate insiders buying their own stock with real money is one of the strongest signals in the market. Congressional trades carry 2.5x weight. Social media sources like Reddit carry 1x — they're noisy on their own, but valuable as corroboration.",
      },
      {
        heading: "Aggregation: from mentions to candidates",
        body: "Raw mentions are grouped by ticker symbol. A symbol becomes a candidate for AI scoring when it meets any of these thresholds: it appears two or more times from a single source, it appears in two or more different sources, or it comes from a high-value source (SEC Insider, Congress, Volume Spike, or Options Flow) even as a single mention. This filters thousands of raw mentions down to dozens of actionable candidates per scan.",
      },
      {
        heading: "Why corroboration matters",
        body: "The aggregation step is where most pump-and-dump schemes fail to pass. A coordinated social media campaign can flood Reddit and StockTwits with mentions of a ticker, but it cannot fake an SEC insider filing or create a real volume spike across exchanges. When a ticker appears across unrelated sources with different incentive structures, the probability of a legitimate catalyst increases. This is the core thesis behind multi-source signal detection: no single source is reliable, but convergence across independent sources is powerful.",
      },
      {
        heading: "From candidates to scored signals",
        body: "Candidates that survive aggregation are scored by AI for breakout potential, run through a 13-flag pump-and-dump filter, and assigned to a stage — Emerging, Building, Consensus, or Filtered. The result is a prioritized watchlist of tickers with the strongest multi-source backing and verifiable catalysts. You can read more about the scoring and filtering process in our posts on AI scoring, pump-and-dump detection, and signal stages.",
      },
    ],
  },
  {
    slug: "pump-and-dump-detection",
    title: "Catching Pump-and-Dump Schemes: The 13-Flag Filter Explained",
    description:
      "How SignalScope uses 13 statistical flags and AI assessment to identify and quarantine pump-and-dump manipulation before it reaches the dashboard.",
    date: "2026-03-14",
    readingTime: "8 min read",
    tags: ["pump-and-dump", "methodology", "filtering"],
    sections: [
      {
        body: "Pump-and-dump schemes remain one of the biggest risks in small-cap and penny stock trading. Promoters artificially inflate a stock's price through misleading social media campaigns, then sell their positions once retail traders have pushed the price up. The challenge for any signal detection platform is distinguishing genuine breakout signals from manufactured hype.",
      },
      {
        heading: "Statistical detection: 13 flags",
        body: "Every candidate ticker in SignalScope is checked against 13 statistical flags before AI scoring begins. A ticker that triggers three or more flags is immediately moved to Filtered status and quarantined from the main dashboard. Two flags triggers an additional AI edge-case assessment. Here are all 13 flags and what they catch.",
      },
      {
        heading: "Price and listing flags",
        body: "The first line of defense targets the types of securities most commonly used in pump-and-dump schemes. The penny_price flag triggers when a stock is priced below $1 with no verifiable catalyst — legitimate sub-dollar stocks exist, but they're overrepresented in manipulation. The sub_dime_52wk_floor flag catches stocks whose 52-week low is below $0.09, which often indicates shell companies or zombie stocks. The otc_listing flag marks stocks on OTC / Pink Sheets, where disclosure requirements are minimal and manipulation is easier.",
      },
      {
        heading: "Social signal flags",
        body: "Several flags target the specific patterns that coordinated social media campaigns produce. The upvote_pump flag fires when a ticker has over 1000 upvotes but only 3 or fewer posts and fewer than 50 comments — a pattern consistent with vote manipulation rather than organic interest. The only_penny_subs flag catches tickers mentioned exclusively in r/pennystocks or r/smallstreetbets, subreddits that attract promotion. The hyperbolic_language flag triggers on three or more hype phrases like 'to the moon', '100x', or 'can't lose'. The coordinated_posts flag detects when 50% or more of post titles are near-identical — a clear sign of a coordinated campaign.",
      },
      {
        heading: "Source and catalyst flags",
        body: "The single_source flag marks tickers that appear in only one data source, which means there is no independent corroboration. The no_news_catalyst flag catches tickers with multiple signals but no verifiable news or filing to explain the interest. The micro_cap_no_catalyst flag triggers for companies with a market cap under $50 million and no news — though SEC Insider and Options Flow signals bypass this flag, since those are verified institutional actions regardless of company size.",
      },
      {
        heading: "Timing flags",
        body: "The sudden_spike flag catches suspicious patterns where three or more Reddit signals all appeared within the last 3 hours with an average of fewer than 10 upvotes — suggesting coordinated posting rather than organic discovery. On the Twitter side, the twitter_bot_promoters flag identifies coordinated low-credibility accounts, while the twitter_coordinated_pump flag triggers when three or more tweets share 40% or more near-identical text.",
      },
      {
        heading: "AI edge-case assessment",
        body: "When a ticker triggers exactly two flags, it falls into a gray zone. Two flags could indicate a legitimate micro-cap breakout that happens to be cheap and social-only, or it could be the start of a pump scheme. In these cases, SignalScope sends the full signal data to an AI model for edge-case assessment. The AI evaluates the context holistically — the nature of the sources, the quality of the underlying story, and whether the flag combination makes sense for a real ticker. If the AI confirms pump-and-dump risk, the ticker is moved to Filtered.",
      },
      {
        heading: "Why three flags?",
        body: "The threshold of three flags was calibrated through backtesting against known pump-and-dump cases and validated against the growing dataset of signal outcomes. Two flags catches too many legitimate small-cap tickers. Four flags lets too many pumps through. Three flags strikes the right balance: it catches the overwhelming majority of coordinated manipulation while preserving legitimate signals from smaller companies. As the dataset grows and the ML model improves, these thresholds are continuously refined.",
      },
    ],
  },
  {
    slug: "sec-insider-filing-analysis",
    title: "SEC Insider Filings: C-Suite Purchase Patterns as Breakout Indicators",
    description:
      "Why corporate insider purchases are one of the strongest breakout signals, and how SignalScope monitors SEC filings for C-suite buying activity.",
    date: "2026-03-13",
    readingTime: "7 min read",
    tags: ["sec-filings", "methodology", "insider-trading"],
    sections: [
      {
        body: "Academic research has consistently shown that corporate insiders — CEOs, CFOs, and board members — earn abnormal returns on their own stock purchases. This makes sense: insiders have the deepest understanding of their company's prospects, and when they buy stock on the open market with their own money, they're putting real capital behind their conviction. SEC insider purchase filings are one of the most reliable predictors of future stock performance available to retail investors.",
      },
      {
        heading: "What counts as a significant insider purchase",
        body: "Not all insider transactions are equal. Stock option exercises and scheduled sales under 10b5-1 plans are routine and carry little predictive value. SignalScope filters specifically for open-market purchases by C-suite executives (CEO, CFO, COO, and board members) of $50,000 or more. These are discretionary purchases where an insider chose to buy stock at the current market price with their own funds. A CEO spending $200K of personal money on company stock is a very different signal than a scheduled option exercise.",
      },
      {
        heading: "Data sources: OpenInsider and EDGAR",
        body: "SignalScope pulls insider transaction data from two complementary sources. OpenInsider aggregates SEC Form 4 filings into an easily scannable format, providing quick access to the latest insider purchases. EDGAR RSS feeds provide the raw filings directly from the SEC. By cross-referencing both sources, the system catches transactions faster and more reliably than monitoring either source alone.",
      },
      {
        heading: "Why insider purchases carry 3x weight",
        body: "In SignalScope's source weighting system, SEC insider purchases carry the highest weight of any source at 3.0x. This means a single insider purchase contributes as much to a ticker's aggregate score as three Reddit mentions. The reasoning is straightforward: insider purchases are verified filings backed by real money from people with material non-public knowledge of their company's direction. The signal cannot be faked, cannot be manipulated by external parties, and has decades of academic support for its predictive value.",
      },
      {
        heading: "Cluster buying patterns",
        body: "The most powerful insider signals come from cluster buying — when multiple insiders at the same company purchase stock within a short timeframe. If a CEO, CFO, and two board members all buy stock in the same week, something is likely happening that insiders believe the market has not yet priced in. SignalScope's aggregation system naturally detects this: multiple SEC Insider signals for the same ticker across a scan period push the ticker toward higher confidence scores.",
      },
      {
        heading: "Combining insider filings with other sources",
        body: "An insider purchase on its own is a strong signal. But when it coincides with rising social media attention, unusual options activity, or a volume spike, the case becomes much stronger. This is where multi-source detection shines. A CEO buying $500K of stock while call options volume spikes and Reddit starts noticing the ticker represents a convergence of independent signals that dramatically increases breakout probability. These multi-source tickers consistently receive the highest AI confidence scores in SignalScope's scoring system.",
      },
    ],
  },
  {
    slug: "congressional-trades-tracking",
    title: "Congressional Stock Trades: STOCK Act Disclosures and Signal Detection",
    description:
      "How SignalScope tracks congressional stock purchases from STOCK Act disclosures and why these trades carry significant predictive weight.",
    date: "2026-03-12",
    readingTime: "6 min read",
    tags: ["congress", "methodology", "filings"],
    sections: [
      {
        body: "Members of the US Congress are required by the STOCK Act of 2012 to disclose stock trades within 45 days. Research has repeatedly shown that congressional portfolios outperform the market on average, raising questions about informational advantages that come from committee assignments, legislative previews, and briefings. Regardless of the debate around fairness, these disclosures are public data — and they represent informed buying decisions from people with unique access to policy direction.",
      },
      {
        heading: "How congressional trade data is collected",
        body: "SignalScope monitors congressional stock purchases from CapitolTrades, which aggregates STOCK Act disclosures. The system focuses exclusively on stock purchases (not sales) of US-listed tickers. Each trade is tracked with a unique transaction ID extracted from the disclosure URL, which enables cross-scan deduplication — ensuring the same trade isn't counted as a new signal in subsequent scans. This is important because congressional disclosures often appear in the data source across multiple days as new filings are published.",
      },
      {
        heading: "Why congressional trades carry 2.5x weight",
        body: "Congressional purchases carry a source weight of 2.5x in SignalScope's scoring system — the same as options flow and second only to SEC insider purchases (3.0x). This weighting reflects the historical outperformance of congressional portfolios and the unique informational position that legislators hold. A senator on the Armed Services Committee purchasing defense contractor stock, or a representative on the Financial Services Committee buying bank stocks ahead of regulatory changes, represents a signal with clear informational asymmetry.",
      },
      {
        heading: "Timing considerations",
        body: "The main limitation of congressional trade data is timing. The STOCK Act allows up to 45 days for disclosure, though many members report faster. SignalScope uses a 7-day publication window to capture recent disclosures while filtering out stale data. The inherent delay means these signals are best used as confirmation of a thesis rather than as real-time triggers. When a congressional purchase coincides with independent social media attention or a volume spike detected in the same scan, the combined signal is much more actionable than the congressional trade alone.",
      },
      {
        heading: "Deduplication across scans",
        body: "A unique challenge with congressional trade data is that the same transaction may appear in the data source across multiple scans as filings propagate through the system. SignalScope solves this by extracting a unique transaction ID from each disclosure URL and maintaining a deduplication check across scans. This ensures that a single congressional purchase is counted once, on its first appearance, rather than inflating the signal count across multiple days. The deduplication logic is covered by dedicated unit tests to ensure reliability.",
      },
      {
        heading: "Congressional trades in the broader signal picture",
        body: "Like insider filings, congressional trades are most powerful when they corroborate other signal sources. A ticker showing up with a congressional purchase, rising Reddit attention, and a volume spike represents a much stronger case than any of those signals alone. The multi-source convergence approach ensures that congressional trades contribute to the overall signal strength without single-handedly driving a recommendation.",
      },
    ],
  },
  {
    slug: "ml-backtesting-approach",
    title: "Machine Learning Backtesting: How SignalScope Gets Smarter Over Time",
    description:
      "How SignalScope uses XGBoost gradient boosting and SHAP analysis to continuously improve signal scoring from real-world outcome data.",
    date: "2026-03-11",
    readingTime: "7 min read",
    tags: ["machine-learning", "backtesting", "methodology"],
    sections: [
      {
        body: "Most signal detection tools score signals once and move on. The scoring rules stay static until someone manually adjusts them. SignalScope takes a different approach: every signal's real-world outcome is tracked, measured, and fed back into a machine learning model that continuously refines how signals are scored, filtered, and staged. The platform gets smarter with every scan.",
      },
      {
        heading: "The feedback loop",
        body: "The backtesting pipeline follows five steps: price snapshots, return computation, feature engineering, model training, and threshold optimization. Twice daily — at market open and close — automated price snapshots capture the current price of every validated ticker. Returns are then computed at 1, 3, 7, and 30 days after detection, building a growing time-series for each signal. Tolerance windows handle weekends and holidays: the 1-day return uses an 18-48 hour window, the 3-day return uses 54-120 hours, and so on. The system always picks the snapshot closest to the target time within these windows.",
      },
      {
        heading: "Feature engineering",
        body: "Each signal in the dataset carries dozens of features: the number and type of sources, source weights, AI score, opportunity score, signal stage, P&D flag count, market cap, price, volume metrics, 52-week range position, sector, signal freshness, velocity, novelty indicators, and more. These features capture both the signal characteristics at detection time and the market context. The dataset grows with every scan, giving the model more examples to learn from.",
      },
      {
        heading: "XGBoost gradient boosting",
        body: "The ML model uses XGBoost, a gradient boosted decision tree algorithm widely used in quantitative finance. XGBoost excels at finding non-linear relationships between features and outcomes — for example, that signals with a specific combination of source types, price ranges, and social velocity tend to outperform. The model is retrained periodically as the dataset grows, using standard train/test splits to validate that improvements generalize rather than overfit.",
      },
      {
        heading: "SHAP analysis for interpretability",
        body: "Raw model predictions are useful, but understanding why the model makes certain predictions is essential for improving the signal pipeline. SHAP (SHapley Additive exPlanations) provides a principled way to attribute each prediction to individual features. This reveals which factors are actually driving accuracy. For example, SHAP analysis might show that the combination of SEC insider purchases and volume spikes is a much stronger predictor than AI score alone. These insights directly inform which thresholds to adjust, which flags to add or remove, and how to weight different source types.",
      },
      {
        heading: "Closing the loop",
        body: "The insights from XGBoost and SHAP flow back into the signal pipeline as concrete optimizations: adjusting AI score thresholds for stage assignments, refining P&D flag logic, reweighting sources, and tuning novelty bonuses. Each optimization is tracked in an experiment log with commit hashes, performance metrics, and descriptions of what changed. Over time, this creates a record of which changes moved the needle and which were noise — informing future iterations of the model and the pipeline.",
      },
    ],
  },
  {
    slug: "x402-api-access-ai-agents",
    title: "x402 Protocol: How AI Agents Pay for Stock Signal Data",
    description:
      "How the x402 payment protocol enables AI agents to access SignalScope's data via micropayments in USDC on Base — no registration or API key needed.",
    date: "2026-03-10",
    readingTime: "6 min read",
    tags: ["x402", "api", "ai-agents"],
    sections: [
      {
        body: "AI agents need access to real-time data, but traditional API access models — API keys, OAuth flows, subscription plans — create friction that autonomous agents cannot easily navigate. The x402 protocol solves this by extending HTTP with a native payment layer: when an agent hits a monetized endpoint, it receives an HTTP 402 response with payment details, pays in USDC on Base (L2), and retries to receive the data. No registration, no API key, no subscription.",
      },
      {
        heading: "How x402 works",
        body: "The x402 protocol builds on a familiar HTTP pattern. When an AI agent sends a GET request to a monetized endpoint (like /api/tickers/trending), the server responds with HTTP 402 Payment Required instead of 401 Unauthorized. The 402 response body includes the payment amount, the wallet address, the network (Base mainnet), and a payment scheme. The agent constructs a USDC transfer using EIP-3009 (transferWithAuthorization), attaches the payment proof as an X-PAYMENT header, and retries the request. The server verifies the payment through a facilitator and returns the data. The entire flow is atomic — you are only charged on successful responses.",
      },
      {
        heading: "Pricing: micropayments that make sense",
        body: "SignalScope's x402 pricing reflects the value and cost of each endpoint. Signal data endpoints (trending tickers, individual ticker data, history, performance, related tickers) cost between $0.005 and $0.01 per call. AI-generated reports with trade setups cost $0.05, reflecting the AI inference cost. The search endpoint remains free — letting agents discover tickers before deciding which ones to pay for. These prices are designed for high-frequency automated access: an agent querying 20 tickers with reports would spend about $1.10.",
      },
      {
        heading: "USDC on Base: near-zero gas",
        body: "Payments settle in USDC on Base, an Ethereum L2 network. Base offers near-zero gas fees (typically under $0.01 per transaction), making micropayments practical. The payment uses EIP-3009 transferWithAuthorization, which means the agent pre-authorizes a specific transfer amount to a specific address — there's no open-ended approval that could be exploited. The facilitator (hosted by Coinbase at facilitator.x402.org) validates the payment proof and confirms settlement.",
      },
      {
        heading: "Coexisting with traditional auth",
        body: "x402 is an additional access method, not a replacement. SignalScope's endpoints support three auth methods: session cookies (web dashboard), API keys (programmatic access for registered users), and x402 micropayments (anonymous pay-per-call). If a request includes a session cookie, Bearer token, or API key, normal auth is used. Only requests without any credentials trigger the x402 flow. This means existing users are unaffected — x402 simply opens the API to agents that cannot or prefer not to register.",
      },
      {
        heading: "Building an x402-compatible agent",
        body: "Any AI agent with access to a USDC wallet on Base can use x402. The workflow is: send a request, check for 402 status, parse the payment requirements from the response, sign a USDC transfer authorization, add it as an X-PAYMENT header, and retry. Libraries and SDKs for x402 are available at x402.org, with support for JavaScript/TypeScript, Python, and other languages. SignalScope also provides an Agent Skill document (at /skill/SKILL.md) that gives AI assistants all the context they need to interact with the API.",
      },
    ],
  },
  {
    slug: "volume-spike-detection",
    title: "Volume Spike Detection: What 2x+ Volume Means for Breakout Trading",
    description:
      "How SignalScope detects volume spikes and why trading volume at 2x or more of the 10-day average is a key breakout indicator.",
    date: "2026-03-09",
    readingTime: "5 min read",
    tags: ["volume", "technical-analysis", "methodology"],
    sections: [
      {
        body: "Volume is the fuel that drives price movement. A stock can have the best fundamental story in the world, but without buyers stepping in with real capital, the price does not move. Conversely, a sudden spike in trading volume — well above normal levels — often precedes or accompanies a significant price move. This is why volume analysis has been a cornerstone of technical analysis for over a century.",
      },
      {
        heading: "The 2x threshold",
        body: "SignalScope flags a volume spike when a stock's current trading volume reaches 2x or more of its 10-day average. This threshold is deliberately conservative: a stock trading at twice its normal volume represents a meaningful increase in market interest, but it filters out the day-to-day noise of minor volume fluctuations. The 10-day average provides a recent baseline that accounts for changing market conditions — a stock that normally trades 1 million shares per day being flagged at 2 million is a very different signal than a thinly-traded stock going from 10,000 to 20,000 shares.",
      },
      {
        heading: "What drives volume spikes",
        body: "Volume spikes can be caused by many factors: earnings announcements, analyst upgrades or downgrades, FDA approvals, contract wins, merger and acquisition activity, sector rotation, or breaking news. Some volume spikes are driven by speculative interest that fizzles quickly. The key is context: a volume spike that coincides with SEC insider buying, rising social media attention, or unusual options activity is much more likely to precede a sustained move than a volume spike in isolation.",
      },
      {
        heading: "Volume as corroboration",
        body: "In SignalScope's multi-source framework, volume spikes carry a source weight of 2.0x — higher than social media sources (1.0x) but lower than SEC insider purchases (3.0x). This weighting reflects volume's role as a powerful corroborating signal: it confirms that real money is moving into a stock, but it does not on its own tell you why. When a volume spike coincides with signals from other sources, the combined evidence is significantly stronger than either signal alone.",
      },
      {
        heading: "Watchlist coverage",
        body: "SignalScope monitors volume across a curated watchlist of liquid stocks. The watchlist currently covers over 100 symbols, including actively traded stocks across sectors and market caps. Volume data is sourced from Yahoo Finance, providing reliable intraday and historical volume figures. Stocks trading at 2x+ their 10-day average volume are flagged as volume spike signals and enter the aggregation pipeline alongside signals from other sources.",
      },
    ],
  },
  {
    slug: "multi-source-signal-aggregation",
    title: "Why Multi-Source Signal Aggregation Beats Single-Source Analysis",
    description:
      "How combining signals from 7 independent data sources creates a more reliable picture of breakout potential than monitoring any single source.",
    date: "2026-03-08",
    readingTime: "7 min read",
    tags: ["signals", "methodology", "aggregation"],
    sections: [
      {
        body: "If you only watch Reddit, you will see pump-and-dump schemes that look like organic momentum. If you only watch SEC filings, you will miss the social catalysts that drive short-term price action. If you only watch volume, you will catch moves after they have already started but miss the context of why. Single-source analysis is inherently limited because each data source has its own biases, blind spots, and failure modes. Multi-source aggregation overcomes these limitations by requiring convergence across independent channels.",
      },
      {
        heading: "Independence matters",
        body: "The value of multi-source detection comes from source independence. Reddit users posting about a ticker do not know what SEC insiders are filing. Congressional trade disclosures are published independently of options market activity. Volume spikes are driven by actual order flow, not social media posts. When multiple independent sources converge on the same ticker, the probability of a real catalyst rises dramatically — because coordinating a fake signal across all of these channels simultaneously is nearly impossible.",
      },
      {
        heading: "Source weights encode reliability",
        body: "Not all sources contribute equally to a signal's aggregate score. SignalScope assigns weights based on historical predictive value and the difficulty of manipulation. SEC insider purchases carry the highest weight (3.0x) because they represent verified, real-money transactions from people with deep knowledge of the company. Options flow and congressional trades carry 2.5x weight. Volume spikes carry 2.0x. Social media sources — Reddit, X/Twitter, StockTwits — carry 1.0-1.2x weight. These weights mean that a single insider filing contributes as much as three Reddit posts, reflecting the relative signal quality.",
      },
      {
        heading: "The candidacy threshold",
        body: "Raw mentions flood in from all seven sources on every scan. Most are noise. The aggregation step applies a candidacy threshold: a ticker must appear at least twice from a single source, appear in at least two different sources, or come from a high-value source (SEC Insider, Congress, Volume Spike, Options Flow) to qualify for AI scoring. This single step eliminates the vast majority of one-off mentions and social media noise, focusing AI evaluation on tickers with meaningful signal density.",
      },
      {
        heading: "Velocity and momentum",
        body: "Beyond simple counts, aggregation tracks signal velocity — how quickly mentions are accumulating — and cross-scan momentum — whether a ticker's signal strength is growing or fading over time. A ticker that appeared in 2 sources yesterday and 5 sources today is trending differently than one that went from 5 sources to 2. Velocity feeds into AI scoring and stage assignments: high velocity with rising cross-scan appearances can push a ticker from Emerging to Building stage, indicating growing market interest.",
      },
      {
        heading: "Anti-manipulation by design",
        body: "Multi-source aggregation is inherently resistant to manipulation. A bad actor can flood Reddit with ticker mentions, buy StockTwits followers, or run coordinated Twitter campaigns. But they cannot fake an SEC insider filing, create a real congressional trade disclosure, or generate actual volume on exchanges. By requiring corroboration from sources with different incentive structures and different manipulation costs, the aggregation step filters out the majority of pump-and-dump schemes before AI scoring even begins. The 13-flag P&D filter catches the rest.",
      },
      {
        heading: "The result: a prioritized watchlist",
        body: "After aggregation, AI scoring, and P&D filtering, what remains is a prioritized watchlist of tickers with genuine multi-source backing. Each ticker comes with an AI confidence score reflecting evidence strength, an Opportunity score reflecting early-mover potential, a signal stage indicating conviction level, source breakdown showing exactly where the signals came from, and on-demand AI reports with trade setups. This is the output of the entire pipeline: not a flood of mentions, but a curated set of candidates worth investigating further.",
      },
    ],
  },
  {
    slug: "options-flow-detection",
    title: "Options Flow as a Breakout Signal: Reading Unusual Activity in Real Time",
    description:
      "How SignalScope scans options chains for unusual call volume, OTM activity, and call sweeps — and why concentrated options bets often precede breakout moves.",
    date: "2026-03-28",
    readingTime: "7 min read",
    tags: ["options-flow", "methodology", "signals"],
    sections: [
      {
        body: "On March 25, 2026, Firefly Aerospace saw 7,674 call contracts trade at the $30 strike expiring April 17 — a concentrated bullish bet on near-term price movement. The same day, BILL Holdings logged 12,044 contracts and lululemon hit 17,291. OneWater Marine saw heavy put concentration at a single strike. None of these had obvious news catalysts. For options traders, this kind of activity is the signal. For everyone else, it is invisible. Options flow is one of the most underappreciated sources of breakout intelligence because it requires specific knowledge to interpret and is difficult to monitor at scale.",
      },
      {
        heading: "What makes options volume 'unusual'",
        body: "Every listed stock has options trading on it, so raw volume numbers are meaningless without context. What matters is the relationship between today's volume and the normal baseline. SignalScope scans options chains via Yahoo Finance and flags activity that meets specific criteria: unusual call volume relative to historical averages, concentrated out-of-the-money (OTM) activity suggesting directional bets rather than hedging, and call sweeps — large orders that lift through multiple ask prices to get filled quickly. A single institution quietly accumulating calls over a week looks very different from a sweep that hits the tape all at once. Sweeps signal urgency.",
      },
      {
        heading: "Why options flow carries 2.5x source weight",
        body: "In SignalScope's source weighting system, options flow carries 2.5x weight — tied with congressional trades and second only to SEC insider purchases at 3.0x. This weighting reflects a simple reality: options are leveraged instruments, and the people placing large directional bets are typically institutional traders, hedge funds, or informed participants who have done significant research before risking capital. Unlike social media posts, which cost nothing to write, options positions cost real money and expire worthless if wrong. The financial commitment behind options flow makes it a high-quality signal.",
      },
      {
        heading: "OTM calls: the smart money tell",
        body: "Out-of-the-money call buying is particularly interesting because it represents a bet that the stock will move significantly higher before expiration. When a trader buys thousands of OTM calls on a stock trading at $25 with a $30 strike expiring in three weeks, they are betting on a 20%+ move in a short timeframe. This is not hedging. This is a directional conviction bet. When this kind of activity appears for a ticker that is simultaneously showing up in SEC insider filings or volume spikes, the convergence dramatically increases breakout probability.",
      },
      {
        heading: "Volume versus open interest",
        body: "A common mistake is looking at options volume in isolation. The volume-to-open-interest ratio tells you whether today's activity represents new positions or closing of existing ones. High volume with low prior open interest means new money is flowing into the position — a much stronger signal than high volume on a strike that already had thousands of contracts open. SignalScope's options flow scanner considers both the absolute volume and its relationship to existing open interest when flagging unusual activity.",
      },
      {
        heading: "Filtering noise from signal",
        body: "Not all unusual options activity is bullish or even informative. Earnings plays, index rebalancing, and market-maker hedging can all create volume spikes that look unusual but carry no predictive value. The multi-source aggregation approach handles this naturally: options flow alone creates a candidate, but it takes corroboration from other sources — social media attention, volume spikes in the underlying stock, insider purchases — to push a ticker through AI scoring and into the dashboard. The March 25 Firefly Aerospace activity is meaningful precisely because options were not the only signal: when concentrated call buying appears alongside other independent indicators, the case for a breakout strengthens considerably.",
      },
      {
        heading: "Real-time scanning at scale",
        body: "Manually monitoring options chains across hundreds of stocks is impractical. The data is fragmented across chains with dozens of strikes and expirations per ticker. SignalScope automates this by scanning the full options chain for a curated list of actively traded symbols, computing volume ratios against historical baselines, identifying OTM concentration patterns, and flagging call sweeps. The results feed directly into the same aggregation pipeline as every other source — meaning options signals are weighted, scored, and filtered alongside Reddit mentions, insider filings, and volume spikes. The output is a unified picture of market interest, not a separate options-only feed.",
      },
    ],
  },
  {
    slug: "breakout-signals-high-volatility",
    title: "When the VIX Spikes: How Breakout Signals Change in High-Volatility Markets",
    description:
      "How elevated volatility changes the quality and reliability of breakout signals — and why insider purchases during selloffs are among the strongest contrarian indicators.",
    date: "2026-03-27",
    readingTime: "6 min read",
    tags: ["signals", "volatility", "risk-management"],
    sections: [
      {
        body: "On March 27, 2026, the VIX surged 13% to 31.05 — its highest level in months — as escalating tensions between the U.S., Israel, and Iran drove oil prices sharply higher and sent the Dow down over 400 points. The S&P 500 dropped to roughly 6,848 while the Nasdaq held slightly positive, propped up by tech. The Fed had just held rates steady at 3.5-3.75% with its dot-plot projecting only one cut all year. This is the kind of environment that separates robust signal detection from noise chasing. When everything is red, which signals still matter?",
      },
      {
        heading: "Volume spikes become unreliable",
        body: "In calm markets, a stock trading at 2x its 10-day average volume is a genuine signal of unusual interest. In high-VIX environments, nearly everything trades at elevated volume. Broad-based panic selling pushes volume higher across the board as portfolio managers rebalance, stop-losses trigger, and retail traders react to headlines. The 2x threshold that works well during normal markets can flood the pipeline with false positives during selloffs. This does not mean volume signals are useless — it means they need stronger corroboration from independent sources before they carry conviction.",
      },
      {
        heading: "Social media degrades into noise",
        body: "When VIX is above 25, the quality of social media signals drops significantly. Fear-driven posting floods Reddit and Twitter with bearish sentiment, apocalyptic predictions, and reactive takes that have no predictive value. Tickers mentioned during panic are often discussed because they are falling, not because they are about to break out. The usual social media patterns — organic discovery of under-the-radar tickers, growing attention ahead of a catalyst — get drowned out by market-wide panic commentary. SignalScope's multi-source requirement naturally filters much of this: a ticker needs corroboration from filings, options, or volume to advance beyond social mentions.",
      },
      {
        heading: "Insider purchases become the strongest signal",
        body: "Here is where high volatility creates opportunity rather than noise. When a CEO spends $500,000 of personal money buying company stock while the broader market is in freefall, that is one of the most powerful signals in finance. Insider purchases during drawdowns have historically produced the strongest forward returns of any insider buying pattern. The logic is straightforward: insiders know their business. If the broad market is selling their stock because of geopolitical fears that have nothing to do with the company's fundamentals, and the CEO responds by buying, the informational asymmetry is enormous. These are the signals that survive volatility filtering with the highest conviction.",
      },
      {
        heading: "Congressional and options signals hold steady",
        body: "Congressional stock purchases and unusual options flow are relatively unaffected by broad market volatility because they reflect individual conviction rather than market sentiment. A senator buying defense contractor stock during Middle East tensions is arguably a stronger signal during conflict than during peacetime — the informational advantage is more acute. Similarly, concentrated call buying during a selloff indicates someone believes a specific stock will outperform regardless of the macro backdrop. These source types maintain their predictive quality in high-VIX environments precisely because they represent deliberate, informed actions rather than reactive behavior.",
      },
      {
        heading: "How the pipeline adapts",
        body: "SignalScope does not change its source weights based on market conditions — the methodology is consistent regardless of VIX levels. But the multi-source convergence requirement inherently raises the bar during volatility. When volume spikes are everywhere and social media is all noise, the only tickers that survive aggregation are those backed by high-quality sources: insider filings, congressional trades, and unusual options activity. The pipeline naturally becomes more selective during fear, surfacing fewer tickers but with higher average conviction. This is exactly the behavior you want from a signal detection system — more conservative when the environment is uncertain, not less.",
      },
      {
        heading: "What to watch for now",
        body: "With the VIX above 30 and geopolitical uncertainty elevated, the signals worth paying attention to are insider cluster buying during the drawdown, concentrated options positioning in sectors directly affected by the catalyst (energy, defense, shipping), and any congressional purchases that align with committee-relevant sectors. The tickers that appear across these sources while the broader market panics are the strongest contrarian candidates. When fear is at its peak, the convergence of independent, money-backed signals is the clearest lens available.",
      },
    ],
  },
  {
    slug: "congressional-trading-ban-reform",
    title: "The Congressional Trading Ban Debate: What It Means for Signal Detection",
    description:
      "With bipartisan bills to ban congressional stock trading gaining momentum in 2026, what would reform mean for one of SignalScope's highest-weighted signal sources?",
    date: "2026-03-26",
    readingTime: "6 min read",
    tags: ["congress", "regulation", "signals"],
    sections: [
      {
        body: "March 2026 has been the most active month for congressional stock trading reform since the STOCK Act passed in 2012. On March 18, Senators Bill Cassidy and Pete Ricketts introduced the Stop Insider Trading Act, which would prohibit members of Congress, their spouses, and dependent children from purchasing publicly traded stocks and require seven-day public notice before any sales. A week earlier, Representative Chris Pappas introduced the No Getting Rich in Congress Act with similar provisions. A separate House bill, the End Congressional Stock Trading Act, is also advancing. Public support sits at 86% across party lines. The question is no longer whether reform is coming, but what form it takes — and what it means for anyone who uses congressional trade data as a market signal.",
      },
      {
        heading: "Why congressional trades are a 2.5x signal today",
        body: "Congressional stock purchases currently carry a source weight of 2.5x in SignalScope's scoring system — the second-highest of any source, behind only SEC insider purchases at 3.0x. This weight reflects the documented informational advantage that legislators hold: committee assignments give them early visibility into regulatory changes, defense spending, healthcare policy, and infrastructure plans. Academic research consistently shows that congressional portfolios outperform the market on average. A senator on the Armed Services Committee purchasing defense contractor stock, or a representative on the Financial Services Committee buying bank stocks ahead of regulatory changes, represents a signal with clear informational asymmetry. These trades are public data under the STOCK Act, and SignalScope monitors them through CapitolTrades disclosures.",
      },
      {
        heading: "The 45-day lag problem",
        body: "The STOCK Act requires disclosure within 45 days — though many members report faster. This disclosure lag already limits the real-time utility of congressional trades. By the time a purchase appears in the data, the information advantage that motivated the trade may have partially or fully played out. SignalScope addresses this with a 7-day publication window that captures recent disclosures while filtering stale data, and by treating congressional signals as confirmation rather than primary triggers. When a congressional purchase coincides with independent volume spikes or social media attention detected in the same scan, the combined signal is more actionable than the congressional trade alone.",
      },
      {
        heading: "What a full ban would change",
        body: "If the Stop Insider Trading Act or similar legislation passes, members of Congress would be prohibited from purchasing individual stocks entirely. This would eliminate congressional purchase signals from the data pipeline. SignalScope's Congress source — which monitors CapitolTrades for stock purchases by legislators — would stop producing new signals. The 2.5x weighted source that currently contributes to signal aggregation would go silent. For any platform that monitors STOCK Act disclosures, this is a meaningful data loss.",
      },
      {
        heading: "Why the pipeline is designed for this",
        body: "Multi-source signal detection is inherently resilient to the loss of any single source because no source is load-bearing on its own. The aggregation system requires convergence across independent channels — a ticker backed only by congressional purchases and nothing else would be a single-source signal with limited conviction regardless. The strongest tickers in SignalScope's pipeline typically appear across three or more sources: insider filings plus volume spikes plus social attention, or options flow plus insider purchases plus Reddit momentum. Removing one source from a convergence of four still leaves three independent channels corroborating the signal.",
      },
      {
        heading: "What fills the gap",
        body: "If congressional trades disappear, the remaining six sources continue operating: SEC insider filings, options flow, volume spikes, Reddit, Twitter, and StockTwits. SEC insider purchases — the highest-weighted source at 3.0x — provide a similar type of signal (informed buying by people with informational advantages) without the political controversy. Options flow at 2.5x captures institutional positioning that often reflects the same kind of policy-adjacent information that congressional trades represent. The overall pipeline would lose some edge in detecting policy-driven breakouts specifically, but the core thesis — convergence across independent sources with different incentive structures — remains intact.",
      },
      {
        heading: "The real signal in the reform debate",
        body: "Paradoxically, the push to ban congressional trading makes the remaining disclosures more valuable in the near term. As reform legislation advances, legislators may accelerate their trading activity before new rules take effect — creating a window of heightened signal density. The market already pays closer attention to congressional trades when the political spotlight is on them. With 86% public support and bipartisan sponsorship, some form of restriction is likely to pass eventually. Until it does, STOCK Act disclosures remain one of the most unique data sources available to signal detection platforms — publicly available, legally mandated, and backed by the informational asymmetry of legislative power.",
      },
    ],
  },
];

export const blogPosts = blogPostsUnsorted.toSorted(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);
