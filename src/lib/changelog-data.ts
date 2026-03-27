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
    date: "2026-03-28",
    title: "Deeper Reddit & Twitter Harvesting",
    changes: [
      {
        category: "improved",
        items: [
          "Reddit harvester now fetches hot posts (top 25) in addition to new and rising, giving each subreddit three signal angles. Comment fetches are deduplicated across all sorts so the same thread is never fetched twice.",
          "Reddit harvester paginates new posts across up to 3 pages for WSB and 2 pages for stocks/pennystocks — up to 3× more signals per harvest run.",
          "Flair-based velocity weighting: DD and News posts receive a signal boost; Meme, YOLO, and Gain/Loss posts are down-weighted. Daily threads and megaposts are deprioritized.",
          "Twitter/X harvester now filters retweets (-is:retweet), eliminating duplicate content while retaining engagement metrics captured on original tweets.",
          "Twitter/X harvester paginates using next_token across up to 3 pages per harvest (configurable via X_MAX_PAGES, max 5) — up to 3× more tweets analysed per run.",
        ],
      },
    ],
  },
  {
    date: "2026-03-27",
    title: "AI Cost Tracking, Error Boundaries, Data Freshness Indicators",
    changes: [
      {
        category: "new",
        items: [
          "AI cost tracking: every OpenAI/Anthropic call is now logged per-call with provider, model, token counts, and cost — visible in the admin dashboard broken down by call point (scoring, P&D, report, promo), trigger (harvest, batch-report, on-demand, promo), and per-harvest scan.",
          "React error boundaries added to all dashboard pages — runtime errors now show a friendly 'Something went wrong' message with a Try again button instead of crashing the whole page.",
          "Performance and Trending pages now display 'Updated X ago' in the header so you always know how fresh the data is.",
        ],
      },
      {
        category: "improved",
        items: [
          "Keyboard users can now skip past the sidebar with a Skip to main content link that appears on focus.",
          "Filter toggle, stage tabs, and return period buttons now expose selected/expanded state via ARIA attributes for screen readers.",
          "Public API endpoints (ticker data, trending, network) are now rate-limited to prevent abuse.",
          "Database indexes added for signal velocity sorting and trending date/stage scans — faster dashboard queries.",
        ],
      },
    ],
  },
  {
    date: "2026-03-25",
    title: "Dashboard & Methodology Redesign, Twitter Reply Engagement, Dynamic Ticker OG Images, Automated Promo Tweets",
    changes: [
      {
        category: "new",
        items: [
          "After posting each ticker tweet, SignalScope now finds the top-engaged tweet mentioning that cashtag in the last 24h and replies to it — increasing reach and engagement in active stock conversations. Only replies to tweets with open reply settings to avoid 403 errors.",
          "Ticker pages now generate dynamic Open Graph images — when a tweet links to a ticker, Twitter shows a card with the ticker symbol, recommendation badge, price, arc gauges, tags, thesis, and risks instead of the generic site image.",
          "Automated promotional tweets — 3 AI-generated tweets per day (10 AM, 2 PM, 6 PM ET) rotating through 20 feature topics. Tweets include live platform stats, trending cashtags for discoverability, 1-2 hashtags, and deep links to the relevant page.",
        ],
      },
      {
        category: "improved",
        items: [
          "Signal cards redesigned — outlined recommendation badge, arc gauge labels above the arc, two-column thesis/risks layout, outlined tag pills, and outlined source chips in the footer.",
          "Stage tabs redesigned as individual pill buttons with inline counts — matches the new design language across the dashboard.",
          "Scan selector now shows date-only in the dropdown with signal/validated counts displayed separately to the left.",
          "'Reading the cards' callout restyled with a left accent border and info icon. Text updated to correctly reflect sort order: AI Confidence first, then Opportunity.",
          "How It Works (methodology) page fully redesigned — pipeline strip with outlined pills, side-by-side arc gauge score explainer, signal source cards with gradient accent bars, horizontal AI scoring color band, P&D flags split into effective vs. informational, and ML backtesting section. Fully mobile-ready.",
          "Connections page now uses price return correlation (Pearson r) instead of scan co-occurrence — edges represent real price movement relationships between tickers. Green edges = positive correlation, red = negative. Filter by minimum correlation strength.",
          "Trending page redesigned — gradient accent stat cards, FILTERS label, subtitle, and consistent zinc-800 borders. Removed score explainer paragraph for a cleaner above-the-fold experience.",
        ],
      },
    ],
  },
  {
    date: "2026-03-24",
    title: "Browse Without an Account, Performance Overhaul & Smarter Alerts",
    changes: [
      {
        category: "new",
        items: [
          "Dashboard is now fully browsable without an account — explore signals, trending tickers, connections graph, performance stats, and ticker detail pages as a guest. Pro features (portfolio, watchlist, AI reports) remain behind sign-in.",
        ],
      },
      {
        category: "improved",
        items: [
          "Performance page rebuilt to track high-confidence signals (AI score ≥70, from March 16 scoring overhaul onwards) — shows per-ticker return bars newest-first, period-aware summary cards (Win Rate and Avg Return update to match the selected 1d/3d/7d/30d horizon), and a weekly cohort table. Pre-overhaul data excluded to avoid comparing against the old scoring semantics.",
          "Dashboard ticker list now sorted by AI score first (then opportunity score), matching the priority order used in email alerts — highest-conviction picks surface at the top.",
          "Daily signal alert emails now send only high-conviction picks (max 6) instead of a broad 15-ticker digest. Tickers must be EARLY stage, AI score ≥ 50, clean P&D record (pndScore ≤ 1), novel (first seen within 3 days), and have an identified catalyst — matching the criteria used by our manual analyst workflow.",
        ],
      },
    ],
  },
  {
    date: "2026-03-22",
    title: "Pro Subscriptions, Smarter P&D Detection & Mobile Polish",
    changes: [
      {
        category: "new",
        items: [
          "Pro subscription ($10/mo or $100/yr) — unlocks API key access (1,000 req/day), on-demand AI report generation for any ticker, and daily email alerts. Subscribe from the new API Access page in the sidebar.",
          "Stripe-powered subscription management — subscribe, cancel, update payment method, and switch between monthly and yearly billing via Stripe's secure checkout and customer portal.",
        ],
      },
      {
        category: "improved",
        items: [
          "P&D filter now distinguishes informational flags (penny price, OTC listing, single source, coordinated posts) from actionable ones — ML backtesting showed these alone don't predict harmful pump patterns. The effective flag threshold is now 3 (down from 4), making detection more accurate without over-flagging legitimate small caps.",
          "VOLUME_SPIKE source weight increased from 2× to 2.5×, reflecting ML finding that volume-backed signals have better near-term follow-through.",
          "Ticker detail page now shows individual P&D flags with colour-coded badges: red for high-risk flags, amber for caution, grey for informational — so you can see exactly why a ticker was flagged.",
          "AI scoring prompt updated with rising mention fraction and historical P&D reputation guidance from latest backtesting run.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Portfolio page dark mode: text, labels, inputs, action buttons, and all three modals (Close, Edit, Delete) are now fully readable in dark mode.",
          "Dashboard stage tabs (Emerging / Building / Consensus) now fully fit on 390px mobile screens — no more clipped tab labels.",
          "Connections graph shows touch-friendly instructions on mobile (tap, double-tap, pinch to zoom) instead of mouse-only wording.",
          "Info hint tooltips on ticker detail stay visible for 3 seconds after a tap on mobile, giving enough time to read the hint.",
        ],
      },
    ],
  },
  {
    date: "2026-03-21",
    title: "Performance Data Quality",
    changes: [
      {
        category: "improved",
        items: [
          "Reverse splits and other corporate actions are now automatically detected and excluded from performance statistics — prevents misleading best performer entries caused by nominal price changes unrelated to actual returns.",
          "Best and worst performers now show only signals from the last 30 days, keeping the view relevant and timely.",
        ],
      },
    ],
  },
  {
    date: "2026-03-20",
    title: "Dark Mode & UI Polish",
    changes: [
      {
        category: "improved",
        items: [
          "Full dark mode support across all dashboard pages — signals, trending, connections, ticker detail, portfolio, performance, and profile.",
          "Ticker detail page redesigned with cleaner layout, improved trade setup display, and better signal source breakdown.",
          "Related tickers and co-occurrence panels updated for consistent dark/light theming.",
          "Signal tiles on the main dashboard redesigned with improved typography and spacing.",
          "Trending page and sparklines now adapt to the active theme.",
        ],
      },
    ],
  },
  {
    date: "2026-03-19",
    title: "Stage Rename, x402 Payment Tracking & Admin Improvements",
    changes: [
      {
        category: "new",
        items: [
          "x402 micropayment tracking: every verified USDC payment is now recorded to the database with endpoint, amount, and payer wallet address.",
          "Admin payment dashboard: new x402 Payments summary tile, Revenue by Endpoint table, and Recent Payments log visible in the admin panel.",
        ],
      },
      {
        category: "improved",
        items: [
          "Admin page tiles are now more compact — smaller padding, tighter rows, and up to 4 columns on wide screens.",
          "ML-driven price floors: sub-$0.12 stocks without a catalyst are now capped at EARLY stage, and social-only CONFIRMED requires price >= $0.52 for 7d follow-through.",
          "Reshaped opportunity scoring: tickers validated over 3-5 days now score highest (ML shows best near-term returns), while truly novel tickers get a reduced premium.",
          "Moderate Reddit engagement (33-150 comments) now boosts opportunity score, reflecting ML finding that genuine discussion predicts positive 3d returns.",
          "Updated AI scoring prompt with price quality guidance, age sweet-spot weighting, and moderate comment engagement signals from latest backtesting.",
          "Performance breakdown tables now include a Median Return column for a more robust view of typical outcomes alongside average returns.",
          "Signal Confidence and Early-Mover Score breakdown tables now include descriptions explaining what each tier means.",
          "Best/Worst Performers table now shows detection date so you can see how old each signal is.",
          "Best/Worst Performers and Win Rate/Avg Return chart now scoped to emerging signals only (EARLY/FORMING/CONFIRMED), excluding unscored tickers.",
          "Performance chart now uses a true 7-day rolling window average instead of a cumulative expanding mean — each bar shows the avg return for signals detected in the 7 days ending on that date.",
          "Win Rate and Avg Return summary tiles now reflect the same rolling window as the chart, and update correctly when switching between 1d/3d/7d/30d return horizons.",
          "Performance chart extracted into a shared component used on both the dashboard and landing page, ensuring identical calculations everywhere.",
          "Portfolio position cards are more compact with less vertical padding.",
          "Portfolio page mobile layout improvements for better usability on small screens.",
          "API response fields for emerging-stage stats renamed from `early*` to `emerging*` for consistency with stage labels.",
          "Signal stages in all API responses now use human-readable names: Emerging, Building, and Consensus (previously EARLY, FORMING, CONFIRMED). DB schema unchanged; both old and new names accepted as filter inputs.",
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
          "AI reports for top 10 emerging tickers are now pre-generated automatically after each monitoring run — no more waiting on first view.",
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
          "Reports and trade setups now generate on-demand when you view a ticker, reducing monitoring processing time and AI costs.",
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
          "Congressional trading source: stock trades reported by US Congress members via CapitolTrades.com are now monitored and scored as signals.",
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
