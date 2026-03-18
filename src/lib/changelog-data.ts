export interface ChangelogEntry {
  date: string; // ISO date string
  title: string;
  changes: {
    category: "new" | "improved" | "fixed";
    items: string[];
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-03-19",
    title: "Performance Page & Portfolio Polish",
    changes: [
      {
        category: "improved",
        items: [
          "Performance breakdown tables now include a Median Return column for a more robust view of typical outcomes alongside average returns.",
          "Signal Confidence and Early-Mover Score breakdown tables now include descriptions explaining what each tier means.",
          "Best/Worst Performers table now shows detection date so you can see how old each signal is.",
          "Best/Worst Performers and Win Rate/Avg Return chart now scoped to emerging signals only (EARLY/FORMING/CONFIRMED), excluding unscored tickers.",
          "Portfolio position cards are more compact with less vertical padding.",
          "Portfolio page mobile layout improvements for better usability on small screens.",
        ],
      },
    ],
  },
  {
    date: "2026-03-16",
    title: "ML-Driven Scoring & Badge Refresh",
    changes: [
      {
        category: "new",
        items: [
          "NasdaqCM badge on signal cards — ML backtesting shows NasdaqCM penny stocks are the top-performing exchange segment across all return horizons.",
        ],
      },
      {
        category: "improved",
        items: [
          "Opportunity Score now factors in exchange (AMEX/NasdaqCM penny +8pts) and recovery ratio (wk52 high/price, up to +7pts), both top ML features.",
          "Novelty weight reduced (30→20pts) to make room for exchange and recovery signals that better predict returns.",
          "Nano-cap floor raised from $5M to $10M for social-only tickers — ML analysis shows sub-$10M stocks without a catalyst source average -25% returns.",
        ],
      },
    ],
  },
  {
    date: "2026-03-15",
    title: "Opportunity Score, Batch Reports & ML Pipeline Tuning",
    changes: [
      {
        category: "new",
        items: [
          "New Opportunity Score (0–100) ranks signals by early-mover potential — novel, fast-moving, small-cap tickers near 52-week lows score highest.",
          "Dashboard and trending pages now sort by Opportunity Score instead of AI confidence, surfacing highest-alpha signals first.",
          "Performance page shows returns broken down by both Signal Confidence (AI Score) and Early-Mover Score (Opportunity).",
          "New 'Opportunity Score' sort option on the Trending page.",
          "AI reports for top 10 emerging tickers are now pre-generated automatically after each harvest — no more waiting on first view.",
          "High SI badge for stocks with 7.5–15% short interest.",
          "High Velocity badge for signals with avgVelocity >= 2.5.",
          "Recovery badge for stocks near 52-week lows with 3x+ upside to prior highs.",
          "Near 52W Low badge now green (positive signal per ML analysis).",
          "Ticker Connections page: interactive network graph showing how tickers are related through scan co-occurrence, with drag-to-explore and click-to-center.",
          "Related Tickers section on ticker detail pages — see which tickers frequently appear alongside the one you're viewing, with Jaccard correlation scores.",
        ],
      },
      {
        category: "fixed",
        items: [
          "AI reports no longer default to 'Avoid' for well-corroborated emerging signals — report generator now sees full source list and prioritizes catalyst signals in samples.",
        ],
      },
      {
        category: "improved",
        items: [
          "Ticker detail page shows Opportunity Score prominently with AI Score as a secondary metric.",
          "Email alerts now prioritize tickers by opportunity score.",
          "Comment-heavy signals (>150 comments, low upvote ratio) now demoted — ML shows high comment counts predict worse 7d returns.",
          "High-conviction signals (>200 upvotes, >5:1 upvote/comment ratio) get a scoring and stage boost.",
          "Widened NasdaqCM vs AMEX penny stock gap: NasdaqCM requires higher scores for CONFIRMED and FORMING stages, matching ML performance data.",
          "Raised micro-cap P&D threshold from $25M to $40M and tightened upvote-pump detection to flag only extreme manipulation cases.",
          "New short squeeze FORMING stage for stocks with 7.5%+ short interest on AMEX/Nasdaq small-cap exchanges.",
          "New recovery play CONFIRMED path for beaten-down stocks near 52-week lows with high upside ratio.",
          "Lowered short squeeze CONFIRMED threshold from 20% to 15% short float.",
          "Market cap EARLY floor reduced from $10M to $5M to capture more micro-cap opportunities.",
          "Refactored signal reconstruction into a shared helper, reducing code duplication between on-demand and batch report generation.",
        ],
      },
    ],
  },
  {
    date: "2026-03-14",
    title: "Portfolio Alerts & Live Performance Stats",
    changes: [
      {
        category: "new",
        items: [
          "Personalized portfolio alert emails: get notified when stocks in your portfolio reach Consensus or Building stage in the daily scan.",
          "Live performance stats on the landing page: win rate, average 7-day return, and a rolling cumulative return chart for emerging and building signals.",
        ],
      },
      {
        category: "improved",
        items: [
          "Performance page summary cards and cumulative chart now focus on emerging and building signals for more actionable metrics.",
        ],
      },
    ],
  },
  {
    date: "2026-03-13",
    title: "AI Trade Setups & On-Demand Reports",
    changes: [
      {
        category: "new",
        items: [
          "AI Trade Setup card on ticker detail page: entry range, stop loss, two price targets, timeframe, risk/reward ratio, and confidence level for Buy and Strong Buy tickers.",
        ],
      },
      {
        category: "improved",
        items: [
          "Reports and trade setups now generate on-demand when you view a ticker, reducing harvest processing time and AI costs.",
        ],
      },
    ],
  },
  {
    date: "2026-03-12",
    title: "Trending Page Overhaul & Stage Renames",
    changes: [
      {
        category: "new",
        items: [
          "Advanced filters on trending page: filter by stage, source, trend direction, and minimum appearances.",
          "Multiple sort options for trending tickers: appearances, trend, latest score, and latest price.",
          "Mobile-optimized trending UI with collapsible filter panel and responsive card layout.",
          "Options Flow source marked active with updated symbol counts.",
        ],
      },
      {
        category: "improved",
        items: [
          "Signal stages renamed for clarity: Early → Emerging, Forming → Building, Confirmed → Consensus.",
          "Email alerts now lead with Emerging signals for earlier actionability.",
          "Methodology page updated with recolored stage badges matching signal semantics.",
        ],
      },
    ],
  },
  {
    date: "2026-03-11",
    title: "ML-Tuned Filtering",
    changes: [
      {
        category: "improved",
        items: [
          "P&D filtering thresholds and confidence badge cutoffs updated based on ML backtest analysis.",
          "Stage assignment logic (EARLY / FORMING / CONFIRMED) refined using ML-derived optimal thresholds.",
          "AMEX penny stock signals now correctly downgraded using ML findings.",
        ],
      },
    ],
  },
  {
    date: "2026-03-10",
    title: "Performance Page Redesign",
    changes: [
      {
        category: "improved",
        items: [
          "Performance page overhauled: weekly cohorts, period-over-period comparison, and cumulative returns chart.",
        ],
      },
    ],
  },
  {
    date: "2026-03-08",
    title: "Congressional Trades, Leaderboard & API Keys",
    changes: [
      {
        category: "new",
        items: [
          "Congressional trading source: stock trades reported by US Congress members via CapitolTrades.com are now harvested and scored as signals.",
          "Portfolio leaderboard: compare your gains against other users over 3d, 7d, and 30d windows.",
          "API key authentication: generate a personal API key from your Profile page to access all endpoints programmatically.",
          "AI Agent Skill: connect any LLM (Claude, ChatGPT, etc.) to your SignalScope account via the downloadable skill file.",
          "Close date shown on closed portfolio positions.",
        ],
      },
    ],
  },
  {
    date: "2026-03-07",
    title: "Trending Tickers",
    changes: [
      {
        category: "new",
        items: [
          "Trending page: see which tickers are appearing across multiple scans, with rising/falling/stable momentum labels.",
          "ML backtesting section added to the Methodology page — how the pipeline self-improves over time.",
        ],
      },
    ],
  },
  {
    date: "2026-03-06",
    title: "Price Tracking & Portfolio Editing",
    changes: [
      {
        category: "new",
        items: [
          "Continuous price snapshots: returns at 1d, 3d, 7d, and 30d are now computed from an automated price time-series rather than a single data point.",
          "Edit and delete portfolio positions directly from the portfolio page.",
          "Score history on ticker detail page is now grouped by date with expandable rows.",
        ],
      },
    ],
  },
  {
    date: "2026-03-05",
    title: "Mobile Auth & ML Backtesting",
    changes: [
      {
        category: "new",
        items: [
          "Mobile Bearer token authentication: sign in from native apps with access + refresh token rotation.",
          "ML backtesting pipeline: historical signal outcomes are analyzed with XGBoost to continuously optimize scoring and filtering thresholds.",
        ],
      },
    ],
  },
  {
    date: "2026-03-03",
    title: "Signal Quality & Email Alerts",
    changes: [
      {
        category: "new",
        items: [
          "Email alerts: receive a daily digest of CONFIRMED tickers at market open. Opt in from your Profile page.",
        ],
      },
      {
        category: "improved",
        items: [
          "Reddit signal quality improved: minimum engagement filter added to reduce noise from low-activity posts.",
        ],
      },
    ],
  },
  {
    date: "2026-03-02",
    title: "SEO & Analytics",
    changes: [
      {
        category: "new",
        items: [
          "PWA support: SignalScope can now be installed as an app on mobile and desktop.",
          "Google Analytics added for usage insights.",
        ],
      },
    ],
  },
  {
    date: "2026-03-01",
    title: "Watchlist, Profile & Ticker Search",
    changes: [
      {
        category: "new",
        items: [
          "Watchlist: bookmark tickers to track them across scans from your dashboard.",
          "Profile page with username, email alerts toggle, and API key management.",
          "Global ticker search in the sidebar — jump to any ticker instantly.",
          "Dashboard signal stage tab selection is now remembered between sessions.",
        ],
      },
    ],
  },
  {
    date: "2026-02-28",
    title: "Performance Tracking & Ticker Details",
    changes: [
      {
        category: "new",
        items: [
          "Performance page: track your portfolio returns and win rate over time.",
          "Ticker detail page: cross-scan score history, live price refresh, and source breakdown.",
          "Methodology page: full explanation of the signal pipeline, scoring bands, and P&D filter.",
          "Platform stats widget in the sidebar showing total scans and signals.",
        ],
      },
    ],
  },
  {
    date: "2026-02-27",
    title: "Platform Launch",
    changes: [
      {
        category: "new",
        items: [
          "SignalScope is live — AI-powered stock breakout signal detection across Reddit, X/Twitter, StockTwits, SEC insider filings, volume spikes, and options flow.",
          "Signal novelty tracking: tickers are flagged as first-appearance or recurring so you can spot genuinely new momentum.",
          "Full mobile responsiveness across all pages.",
          "Multi-user authentication with email and password.",
        ],
      },
    ],
  },
];

/** ISO date string of the most recent changelog entry */
export const latestChangelogDate = changelog[0].date;
