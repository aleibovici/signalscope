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
