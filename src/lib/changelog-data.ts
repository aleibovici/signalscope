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
    date: "2026-05-23",
    title: "Emerging-focused recommendations and restored trade setups",
    changes: [
      {
        category: "improved",
        items: [
          "Recommendation rule re-anchored on the platform's actual purpose — surfacing emerging stocks before consensus forms. Strong Buy is now reserved for Building-stage tickers with a verifiable catalyst (insider / congress / options) plus two or more sources of corroboration and AI score 60+ (calibration: +2.2% mean 7-day return, 65% hit rate). Buy is reachable from Emerging or Building stage with a catalyst, from Building with multi-source social momentum, or from Consensus only when signals are still fresh (≤6h). Consensus is capped at Buy because by the time the crowd notices, most of the move is played out.",
          "Re-calibration found that high-AI-score Emerging-stage signals actually underperform baseline (mean −0.2% / 43% hit at score≥70 with catalyst). Those tickers still surface on the dashboard at the Emerging stage, but are now labeled Watch rather than carry a Buy label the data does not support.",
          "Recommendation rule version bumped to 2. Existing reports keep their old labels until the next harvest cycle re-scores each row.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Buy and Strong Buy reports are once again emitting a trade setup. The AI prompt now asks the model for only the three fields it actually owns (entry low, entry high, confidence); the server fills in stop-loss, targets, timeframe, and risk/reward from the data-anchored bracket. Newer models had been correctly following the prompt instruction to omit the server-computed fields, which the validator was then rejecting — dropping the entire setup.",
          "If the production database is briefly unavailable while a report is being generated, the trade-setup bracket now falls back to the per-stage hardcoded percentages instead of persisting placeholder zeros.",
        ],
      },
    ],
  },
  {
    date: "2026-05-22",
    title: "Free-tier API keys and deterministic recommendations",
    changes: [
      {
        category: "new",
        items: [
          "API keys are now available to all users — no Pro subscription required.",
          "Free plan: 10 API calls per calendar month (resets on the 1st). Pro plan: 1,000 calls/day.",
        ],
      },
      {
        category: "improved",
        items: [
          "Strong Buy / Buy / Watch / Avoid is now derived from a deterministic rule over AI score, stage, source mix, catalyst presence, and pump-and-dump flags. The AI still writes the catalyst, risks, and analysis prose, but no longer picks the label — eliminating drift between the score and the recommendation.",
          "Thresholds were calibrated against 25,000+ TickerPerformance rows from the last 90 days; each Buy path cleared a +2.5% mean 7-day return and 61%+ hit rate before being locked.",
        ],
      },
    ],
  },
  {
    date: "2026-05-21",
    title: "Data-anchored trade brackets and stage-based exit timing",
    changes: [
      {
        category: "fixed",
        items: [
          "Paper-trading time-exit no longer force-closes every position after 1-2 days. Parser bug in the broker sync route was dropping the unit on \"1-3 weeks\" timeframes and exiting at 1 day; replaced with explicit stage-based hold caps.",
          "Orphan positions whose database row was marked closed but the broker still held the shares are now un-closed on the next sync, restoring time-exit eligibility.",
        ],
      },
      {
        category: "improved",
        items: [
          "Trade-setup target and stop-loss numbers are now derived server-side from realized 7-day returns (P90 by stage, rolling 90-day window) instead of arbitrary AI guesses. Risk/reward always 1:1.5 by construction.",
          "Hold-time is stage-tiered: Emerging exits at 5 days, Building/Consensus at 7 days. Matches the ML model's training horizon (1d/3d/7d).",
          "AI report prompt updated — the model no longer invents target, stop, or timeframe numbers; it focuses on entry range, recommendation, and confidence.",
        ],
      },
    ],
  },
  {
    date: "2026-05-20",
    title: "Docs sync, trade setups, and paper trading mobile polish",
    changes: [
      {
        category: "improved",
        items: [
          "FAQ and Methodology pages updated to match current pipeline behavior — P&D flag counts, 14-day returns, 3× daily snapshots, pure LightGBM model references, and Options Flow as a catalyst source.",
          "AI-generated trade setups use tighter stop-loss and target margins (8% max stop, 10–20% / 20–35% targets) for more realistic risk/reward on breakout entries.",
          "Paper trading Results page KPI summary and cards use edge-to-edge mobile layout with tighter spacing for small screens.",
        ],
      },
    ],
  },
  {
    date: "2026-05-19",
    title: "Signal cards and dashboard polish",
    changes: [
      {
        category: "improved",
        items: [
          "Signal cards show richer tooltips and clearer return data across dashboard and trending views.",
          "Trending page uses a unified ticker card layout consistent with the main signals feed.",
          "Paper trading results page layout refined for readability on smaller screens.",
          "Dashboard layout fixes prevent horizontal overflow on narrow viewports.",
        ],
      },
    ],
  },
  {
    date: "2026-05-17",
    title: "14-day return window + ticker page SEO",
    changes: [
      {
        category: "new",
        items: [
          "14-day return tracking added across all signal types. Insider and congressional trade signals recommend 1–3 week holding periods — the platform now measures and displays 14-day returns alongside 1d/3d/7d/30d windows. A '14d' filter is available on the Trending page and Results page.",
        ],
      },
      {
        category: "improved",
        items: [
          "Ticker detail pages now show a server-rendered snapshot (recommendation, stage, scores, catalyst) that loads instantly and is indexed by search engines — so $LGVN-style pages appear in Google with real signal data, not just a spinner.",
          "Removed server-side GA4 Measurement Protocol calls from the Stripe webhook. These were creating phantom sessions with no landing page attribution and 100% bounce rate, inflating the overall site bounce rate metric.",
          "Upgraded Apple App Store Server Library to v3.1.0.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Security: Apple In-App Purchase verification now rejects tokens claiming a development environment (Xcode/LocalTesting), which bypass Apple's certificate chain — closing a potential free-subscription exploit.",
          "User export endpoint was unreachable from scheduled jobs due to a missing middleware bypass entry.",
        ],
      },
    ],
  },
  {
    date: "2026-05-16",
    title: "Results page consolidated + market regime detection",
    changes: [
      {
        category: "new",
        items: [
          "Market regime detection: the harvester now monitors options market activity across every scan. When a scan shows an unusually high share of large, high-conviction options positions (above the 85th percentile of recent scans), it is flagged as a potential market-wide directional surge. Backtesting across 93 scans and ~23,000 tickers found that breakout signals during those conditions underperform normal scans by ~0.68 percentage points on 3-day returns. The regime filter is being observed before being activated.",
        ],
      },
      {
        category: "improved",
        items: [
          "Signal Quality and Paper Trading are now a single Results page. Signal performance metrics (weekly cohorts, win rates) appear below the live Alpaca trading data.",
          "Removed the per-ticker signal return bar chart — open and closed Alpaca trades already show real per-ticker returns with actual fills.",
        ],
      },
    ],
  },
  {
    date: "2026-05-10",
    title: "Weekly Digest: Top Performers of the Week",
    changes: [
      {
        category: "improved",
        items: [
          "Sunday weekly digest email now headlines the top 5 picks from the past 7 days ranked by best return (1d/3d/7d), instead of the latest scan's highest-conviction names. Subject line shows the leaders with their gains, e.g. \"$AAA +30.0%, $BBB +20.0%, $CCC +10.0%\".",
          "Picks with non-positive returns are excluded so the email always showcases winners. Standalone \"Recent Winners\" proof section was removed since the main table is now itself the winners list.",
        ],
      },
    ],
  },
  {
    date: "2026-05-09",
    title: "New Pricing & Simplified Navigation",
    changes: [
      {
        category: "improved",
        items: [
          "Pro subscription repriced to $2.99/month or $29.99/year (save 16%) — dashboard remains free for all users.",
          "Subscription management moved into the Profile page — no separate API Access menu item.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Live Alpaca paper trading endpoint is now reachable without a session, matching its design as a single shared SignalScope-owned account. iOS and anonymous web visitors no longer hit a 401.",
        ],
      },
    ],
  },
  {
    date: "2026-05-07",
    title: "Streamlined Navigation",
    changes: [
      {
        category: "improved",
        items: [
          "Removed Portfolio from the sidebar and mobile tab bar to simplify the navigation.",
        ],
      },
    ],
  },
  {
    date: "2026-05-06",
    title: "Landing Page Redesign",
    changes: [
      {
        category: "improved",
        items: [
          "Hero section gains a dot-grid texture, stronger ambient glows, and animated signal-ping decoration on desktop.",
          "Headline is larger across all breakpoints with tighter letter-spacing; 'before the crowd' now renders as a sky-to-blue gradient.",
          "Performance stat chips have a live pulsing indicator and soft glow borders.",
          "Feature cards show a top accent line and icon glow on hover.",
          "Section headings across all landing sections now have a small gradient accent rule above them for consistent visual rhythm.",
          "How It Works pipeline steps have larger circles with sky ring halos, gradient-fade connector lines, and subtle watermark step numbers.",
          "CTA section gains depth layers (gradient overlay + top glow) and a more prominent button with ring and shadow.",
          "Nav bar border refined with a faint sky glow underline.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Alpaca Paper (Live) tab: SPY benchmark is now capital + hold weighted to match the portfolio's avg return aggregation. Previously the strategy used dollar-weighted returns while SPY used a simple mean, making the two numbers not directly comparable.",
        ],
      },
    ],
  },
  {
    date: "2026-05-05",
    title: "Analytics, SEO & Traffic",
    changes: [
      {
        category: "fixed",
        items: [
          "Admin traffic is no longer recorded in Google Analytics. Admin sessions now have GA4 tracking suppressed server-side before GTM loads.",
          "Resolved 5 Merchant listings structured data issues flagged by Google Search Console: added missing image, corrected brand to a typed Brand object, and added availability, shippingDetails, and hasMerchantReturnPolicy to all subscription offers.",
        ],
      },
    ],
  },
  {
    date: "2026-05-03",
    title: "iOS App & API Updates",
    changes: [
      {
        category: "new",
        items: [
          "Public /api/changelog endpoint — the iOS app can now fetch the changelog natively.",
        ],
      },
      {
        category: "improved",
        items: [
          "AI scoring prompt and methodology now reflect the latest LightGBM backtest (pool_627, May-03 dataset). Average signal strength across the scan is now the dominant predictor; the historical P&D × current flag interaction is the second-strongest. Feature count updated to 308.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Community votes are now visible to all clients. The /api/votes endpoint was incorrectly protected by middleware, causing vote counts to silently fail for mobile and unauthenticated requests.",
        ],
      },
    ],
  },
  {
    date: "2026-05-01",
    title: "Paper Trading Fixes",
    changes: [
      {
        category: "fixed",
        items: [
          "The Alpaca equity curve chart no longer exaggerates small drawdowns. The y-axis now spans at least 5% of the starting account value, so minor fluctuations don't appear as dramatic losses.",
          "Alpaca paper orders are now placed for BUY-rated tickers as intended. Report generation was previously ordered by opportunity score, so high-confidence BUY signals (AI 80) were skipped in favour of lower-scoring Watch tickers. Reports — and the trade setups they contain — are now generated for the highest AI-score tickers first.",
        ],
      },
    ],
  },
  {
    date: "2026-04-30",
    title: "Alpaca Paper Trading: Source of Truth Rewrite",
    changes: [
      {
        category: "fixed",
        items: [
          "Open positions on the Alpaca Paper (Live) tab now show real-time prices fetched directly from Alpaca on every page load, instead of stale prices from the last sync (which only ran 3x/day). Returns and P&L now match Alpaca's dashboard.",
          "Closed-trade P&L now reflects the actual fill prices from Alpaca's order history, not approximate last-synced prices. The Paper Trading page now treats Alpaca as the sole source of truth for account, positions, and trade history — SignalScope's database is only used to enrich each ticker with its signal metadata (AI score, catalyst, trade setup).",
        ],
      },
      {
        category: "improved",
        items: [
          "Added a 60-second cache on Alpaca position and order-history fetches to keep the page snappy without overloading the Alpaca API.",
          "Per-trade P&L now reflects actual position size (e.g. 20 ABT shares × current price) rather than a synthetic $1k/leg approximation, so totals match Alpaca to the cent. The Open/Closed Positions tables now display the API's real P&L value instead of recomputing it client-side.",
          "Avg Return is now capital-weighted (total P&L ÷ total deployed capital) instead of a simple per-trade mean — this reflects the actual return on capital, not a flat average. The misleading '$1k/leg' label on the Total P&L tile has been replaced with 'open + closed'.",
        ],
      },
    ],
  },
  {
    date: "2026-04-29",
    title: "SEO Improvements",
    changes: [
      {
        category: "improved",
        items: [
          "Rewrote titles and meta descriptions for four blog posts with existing Google Search Console impressions to improve click-through rates.",
        ],
      },
    ],
  },
  {
    date: "2026-04-28",
    title: "Paper Trading UX & Benchmark Improvements",
    changes: [
      {
        category: "improved",
        items: [
          "Alpaca Paper (Live) is now the default tab when opening the Paper Trading page.",
          "S&P 500 benchmark on the Alpaca Live tab now shows a hold-matched average — SPY's return over the exact calendar days each position was held — instead of a flat 30-day return. This makes it a fair apples-to-apples comparison with the portfolio's average per-trade return.",
          'Results tab renamed from "Simulated Portfolio" to "Paper Trading".',
          'Alpaca Paper (Live) tab now shows a "Just launched" banner and a "New" badge explaining why early returns and win rates are not yet statistically meaningful.',
        ],
      },
    ],
  },
  {
    date: "2026-04-25",
    title: "ML Scoring Sync, Performance & Bug Fixes",
    changes: [
      {
        category: "improved",
        items: [
          "AI scoring prompt and methodology refreshed against the latest LightGBM backtest (304-feature pool, exp637a). The dominant predictor is now the interaction between a ticker's prior P&D reputation and its current P&D flag count — repeat offenders get penalised harder. Scan-level context (average signal strength, scan size, log market cap) is recognised as carrying ~50% of model weight.",
          "Dashboard and Trending pages now load vote counts in a single batched API request instead of one request per ticker — reduces network overhead from ~130 requests to 1 on a typical scan page.",
          "Upgraded TypeScript to 6.0.3.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Broker sync: eliminated duplicate market-sell orders on time-based exits — if an exit order already exists for a position, subsequent sync runs skip it instead of firing again.",
          "Broker sync: avgCost now updated from Alpaca's actual fill price on every sync — fixes P&L discrepancy caused by using the limit-order price as a placeholder.",
        ],
      },
    ],
  },
  {
    date: "2026-04-24",
    title: "Community Upvotes",
    changes: [
      {
        category: "new",
        items: [
          "Upvote any ticker on the signals grid, trending page, or ticker detail page. Votes persist across daily harvests — when a symbol reappears, your mark is still there.",
          "Community upvote counts shown on every signal card and ticker detail. Vote weights decay with a 45-day half-life so recent interest counts more than stale enthusiasm.",
        ],
      },
    ],
  },
  {
    date: "2026-04-23",
    title: "Alpaca Paper Trading",
    changes: [
      {
        category: "new",
        items: [
          "SignalScope now auto-executes every recommended trade setup on a real Alpaca paper account — bracket orders with stop-loss and take-profit placed at 9:15 AM ET after each harvest.",
          "New Alpaca Paper (Live) tab on the Paper Trading page shows real fills, open/closed positions, win rate, and P&L vs SPY benchmark.",
        ],
      },
    ],
  },
  {
    date: "2026-04-20",
    title: "Pricing Page",
    changes: [
      {
        category: "new",
        items: [
          "Dedicated /pricing page with Free, Pro, and x402 pay-per-call tiers — full schema.org structured data and canonical URL.",
        ],
      },
    ],
  },
  {
    date: "2026-04-19",
    title: "AI Agent Discovery & Design System Refresh",
    changes: [
      {
        category: "new",
        items: [
          "Published Agent Skills discovery index at /.well-known/agent-skills/index.json listing all three API skill files with SHA-256 digests.",
          "Added RFC 9727 API Catalog at /.well-known/api-catalog (application/linkset+json) advertising all public and authenticated endpoints with service documentation links.",
          "Homepage now emits RFC 8288 Link headers for api-catalog, service-doc, and agent-skills — enabling automated API discovery by AI agents.",
          "Added Content-Signal directives to robots.txt (search=yes, ai-input=yes, ai-train=no) declaring AI content usage preferences per contentsignals.org.",
          "Published MCP Server Card at /.well-known/mcp/server-card.json (SEP-1649) describing the signalscope-mcp stdio server (npx -y signalscope-mcp).",
          "New Tooltip and Select primitives replace native browser dropdowns — consistent styling in light and dark mode, full keyboard navigation.",
          "Mobile bottom tab bar for one-thumb navigation between Signals, Trending, Results, Portfolio, and Profile (iOS safe-area aware).",
        ],
      },
      {
        category: "improved",
        items: [
          "Landing page overhaul: hero now surfaces live performance stats (7-day win rate, avg return, tickers tracked) alongside a server-rendered preview of the top 3 emerging breakouts. Desktop login form moves to /login; new visitors see the product on first scroll. Mobile CTA collision fixed, Share-&-Earn promoted to the hero, and the x402 agent strip is hoisted above the features grid.",
          "New public /pricing page with Product + Offer JSON-LD schema — Free, Pro ($10/mo or $100/yr), and x402 pay-per-call laid out side by side. Pricing link added to the nav on every public page.",
          "Signal cards redesigned: AI confidence is now the hero metric, Opportunity score demoted to a compact rank, and the stage (Emerging/Building/Consensus) is shown as a pill visible in both themes instead of a dark-only accent border.",
          "Chip overflow is capped at two visible tags with a hover-to-see-all indicator, reducing visual noise on the grid.",
          "New type scale (display / h1 / h2 / h3 / body / caption / overline) with weights and tracking baked in — headings render with more deliberate hierarchy across the dashboard.",
          "All prices, scores, and percentages now use tabular numerics so digits align in columns and stop jittering on live updates.",
          "Methodology and AI scoring prompts synced to the latest ML backtest (exp609, mean IC 0.161): architecture updated to the pure LightGBM model on 3d returns (293 features, ~10 active), stale per-feature importance rankings removed, and pnd_micro_cap_no_catalyst elevated as the dominant single predictor.",
          "New blog post: \"How We Built and Evolved the SignalScope ML Model\" — traces the full arc from a Ridge baseline (IC 0.006) to the pure LightGBM model (IC 0.161) with an inline IC progression chart.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Signal count label now pluralizes correctly (\"1 signal\" vs \"2 signals\").",
        ],
      },
    ],
  },
  {
    date: "2026-04-17",
    title: "Blog Expansion & UI Cleanup",
    changes: [
      {
        category: "new",
        items: [
          "Three new blog posts targeting high-intent search queries: Pelosi Stock Tracker guide, Unusual Options Activity Today, and Quiver Quantitative Alternatives comparison.",
        ],
      },
      {
        category: "improved",
        items: [
          "Removed bookmark button from ticker list cards — bookmarking is now only available on the ticker detail page for a cleaner grid view.",
          "Mobile polish: signal-quality tables now fit narrow screens without horizontal scroll, and the admin users panel stacks its filter controls below the heading on mobile.",
        ],
      },
    ],
  },
  {
    date: "2026-04-15",
    title: "Dashboard & Ticker UI Polish",
    changes: [
      {
        category: "improved",
        items: [
          "Signal cards replaced arc gauges with compact score badges — cleaner layout, less visual noise.",
          "Ticker detail header actions and layout reorganized for better usability.",
          "Paper trading returns now align with signal quality scores for consistent performance representation.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Suppressed spurious ECONNREFUSED errors from X API log writes in the harvester.",
        ],
      },
    ],
  },
  {
    date: "2026-04-13",
    title: "ML Model Architecture Update",
    changes: [
      {
        category: "improved",
        items: [
          "Backtest model upgraded to Ridge+LightGBM per-horizon ensemble (exp601) — crossed the 0.10 mean IC barrier with a contrarian 7-day component that converts inverted high-volatility predictions into positive signal.",
          "Methodology, FAQ, and landing page updated to reflect Ridge+LightGBM architecture.",
          "twitter_coordinated_pump flag badge reclassified from bullish (green) to neutral (gray) based on Apr 10 high-vol dataset — flag is no longer statistically significant.",
        ],
      },
    ],
  },
  {
    date: "2026-04-12",
    title: "Account Deletion",
    changes: [
      {
        category: "new",
        items: [
          "Account deletion is now available from your profile page — permanently removes personal data and cancels any active subscription.",
        ],
      },
    ],
  },
  {
    date: "2026-04-11",
    title: "X API Credit Optimization",
    changes: [
      {
        category: "improved",
        items: [
          "Capped Twitter/X discovery lookups to 10 usernames per harvest run, reducing API credit consumption by ~70%.",
          "Reduced ticker batch tweet thread size from 10 to 5 for better credit efficiency.",
        ],
      },
    ],
  },
  {
    date: "2026-04-10",
    title: "Unified Results Section",
    changes: [
      {
        category: "improved",
        items: [
          "Performance and Paper Trading pages merged into a single Results section in the sidebar for a cleaner navigation experience.",
          "Mobile layout improvements for the Results pages — better spacing, responsive tables, and touch-friendly controls.",
        ],
      },
    ],
  },
  {
    date: "2026-04-09",
    title: "Paper Trading & Trending Filters",
    changes: [
      {
        category: "new",
        items: [
          "Capital Growth chart — compare cumulative P&L vs S&P 500 across 3d, 7d, 14d, and 30d lookback periods in a single view.",
          "Lookback period selector (3d, 7d, 14d, 30d) — filter trades by detection window, not just min AI score.",
        ],
      },
      {
        category: "improved",
        items: [
          "Sidebar nav item renamed from 'Signals' to 'Daily Signals'.",
          "Trending tickers now default to sorting by AI Confidence.",
          "Stage, Trend, Sector, Market Cap, and Source filters now support multi-select via a checkmark dropdown — select multiple values to broaden results.",
        ],
      },
      {
        category: "fixed",
        items: [
          "S&P 500 benchmark now uses hold-matched returns (per-trade SPY return over the same hold period) instead of the full 14-day window return — apples-to-apples comparison.",
          "Closed positions now appear correctly on shorter lookback windows (7d, 3d) by extending the detection query to include trades that closed within the window.",
          "Peak Capital card shows the maximum simultaneous capital deployed instead of current open positions only.",
          "Fixed S&P 500 benchmark showing 'Unavailable' — switched SPY data fetching from the deprecated Yahoo Finance historical API to the current chart API.",
        ],
      },
    ],
  },
  {
    date: "2026-04-08",
    title: "X API Cost Optimization",
    changes: [
      {
        category: "improved",
        items: [
          "Reduced X API usage by ~52%: removed 5 unresolvable seed accounts that were re-looked-up every run, reduced follow job from 3x/day to 1x/day, and limited promo tweets to weekdays only.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Seed accounts that can't be resolved on X are now marked as unresolvable in the database, preventing repeated API lookups on every follow job run.",
          "Net premium flow data now correctly passes through the harvest ingest pipeline — previously stripped by schema validation during local-to-cloud handoff.",
          "Trending API now includes net premium and call premium ratio in responses.",
        ],
      },
    ],
  },
  {
    date: "2026-04-07",
    title: "Net Premium Flow & Options Signal Upgrade",
    changes: [
      {
        category: "new",
        items: [
          "Options Flow signals now include net premium flow (call premium minus put premium in dollars) and call premium ratio — quantifying the directional dollar bias behind unusual options activity. Positive net premium = bullish institutional positioning; ratio near 1.0 = heavy call-side conviction.",
        ],
      },
      {
        category: "improved",
        items: [
          "Net premium and call premium ratio propagated through the full pipeline: raw signals, aggregation, validated tickers, and database — available in AI scoring context and ticker detail views.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Stripe checkout/portal redirect URLs now use the configured server URL instead of the client Origin header, closing a redirect manipulation vector.",
          "Portfolio position updates now enforce user ownership on writes (consistent with deletes).",
          "P&D borderline-tier selection now uses effective flag count (excluding informational flags) rather than raw score, reducing false positives.",
          "Performance tweet job now correctly marks only the 3 tweeted tickers as sent, preventing cooldown tokens from burning on untweeted tickers.",
          "Weekly digest ticker sort fixed — early-stage signals (EARLY/FORMING) now correctly rank above CONFIRMED.",
          "NetworkGraph no longer crashes on detached or hidden SVG elements.",
          "Paper trading table fixed to use composite keys, eliminating duplicate React key warnings.",
        ],
      },
    ],
  },
  {
    date: "2026-04-04",
    title: "ML Model Update & SEO Improvements",
    changes: [
      {
        category: "improved",
        items: [
          "P&D detection and AI scoring updated from April 2026 backtest research. Rising signal fraction is now the strongest positive predictor (#1 feature); stale signal count is the strongest negative predictor (#2). sudden_spike flag strength revised to −4.8% avg 7-day return (up from −3.5%).",
          "Backtesting model upgraded from XGBoost to a per-horizon RidgeCV ensemble with EWMA features — three separate models predict 1-day, 3-day, and 7-day returns using IC-weighted blending across 281 features.",
          "Low float shares added as a scoring penalty signal: very low float stocks underperform across all horizons per latest feature importance analysis.",
          "Database query performance improvements: scan detail, trending, network, and related ticker endpoints now use column projection to avoid fetching large AI-generated report fields unnecessarily, reducing latency on the main dashboard queries.",
          "Sitemap now dynamically includes up to 200 recent ticker signal pages (EARLY/FORMING/CONFIRMED, last 30 days, ranked by Opportunity Score) — Google can discover and index individual ticker signal pages.",
          "Blog post pages now include full Open Graph images and Twitter Card metadata, so shares on social media render rich previews with the SignalScope branded image.",
          "Methodology and FAQ pages include Twitter Card metadata.",
          "Landing page now has a semantic <main> landmark, fixing the skip-to-content link and improving accessibility scores.",
          "Improved text contrast on the How It Works section for WCAG AA compliance.",
        ],
      },
    ],
  },
  {
    date: "2026-04-03",
    title: "Paper Trading & SPY Benchmark",
    changes: [
      {
        category: "new",
        items: [
          "Paper Trading — a new dashboard page simulates a $1,000 position in every distinct high-scoring ticker detected in the last 30 days (pick a minimum AI score: 60, 70, 80, or 90). Open positions mark to market using the same snapshot horizons as live performance tracking; after seven days each leg rolls to closed with its realized return. See per-trade P&L, win rate, average hold, and total simulated P&L at a glance.",
          "SPY benchmark — the page compares your simulated basket’s aggregate return to a buy-and-hold in SPY over the same calendar window, so you can see whether the signal book is beating the market over the period.",
        ],
      },
      {
        category: "improved",
        items: [
          "The guided onboarding tour now spotlights Paper Trading in the sidebar so new users can find the simulated book alongside Signals, Trending, and Performance.",
        ],
      },
    ],
  },
  {
    date: "2026-04-02",
    title: "Guided Onboarding Tour",
    changes: [
      {
        category: "new",
        items: [
          "First-time visitors now get an 8-step guided tour — spotlight bubbles walk through the Signal Feed, Trending, Performance, Paper Trading, the signal card, and the ticker search bar. Skip anytime; it never shows again once dismissed.",
        ],
      },
      {
        category: "improved",
        items: [
          "On mobile, the tour opens the sidebar to spotlight nav items in context rather than falling back to plain modals. Targets off-screen are scrolled into view before spotlighting.",
        ],
      },
    ],
  },
  {
    date: "2026-04-01",
    title: "Share & Earn, Performance Tweets, Weekly Digest & Password Recovery",
    changes: [
      {
        category: "new",
        items: [
          "Share & Earn — tweet about SignalScope and get 1 month of Pro free. Free users get an instant 30-day Pro trial; existing subscribers get a $10 credit applied to their next invoice. Find it on your Profile page under \"Share & Earn\".",
          "Performance proof tweets — SignalScope now automatically tweets past successful calls with actual returns (\"$XYZ +23% in 7 days\"), building a public track record on X/Twitter.",
          "Free weekly email digest — every Sunday, all users receive a curated email with the top 3 emerging signals and recent winners. No subscription required.",
          "Forgot your password? A new password recovery flow lets you reset it via email — click \"Forgot password?\" on the login page to get a secure, time-limited reset link.",
        ],
      },
      {
        category: "fixed",
        items: [
          "LinkedIn (and all ad pixel) conversion events now reliably fire on sign-up and checkout — a 300ms flush delay before page navigation ensures pixel requests complete before the browser unloads the page.",
        ],
      },
    ],
  },
  {
    date: "2026-03-30",
    title: "Ticker Detail UX, Yahoo Finance Link & SEO",
    changes: [
      {
        category: "new",
        items: [
          "Ticker detail pages now include a Yahoo Finance link next to the symbol — click the purple Y! icon to jump straight to the full financials, earnings, balance sheet, and more on Yahoo Finance.",
          "52-week high/low range is visualized on ticker detail — quick context for where price sits versus the yearly band.",
        ],
      },
      {
        category: "improved",
        items: [
          "Ticker detail reorganized with tab navigation for cleaner scanning; layout, spacing, and typography refined for readability on small and large screens.",
          "Sparkline charts use adjusted stroke weight and typography for clearer at-a-glance moves.",
          "Landing login area: improved overflow handling and sign-up banner layout so the hero stays usable on narrow viewports.",
          "XGBoost ML backtesting is now prominently featured across all public-facing copy — hero paragraph, register page, FAQ, and the methodology description — so new visitors immediately understand the signal validation pipeline.",
          "Register page source count corrected to 8 (was 7) to reflect the Polymarket addition.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Ticker detail responsive layout and tab navigation behave more reliably across breakpoints.",
        ],
      },
    ],
  },
  {
    date: "2026-03-29",
    title: "Polymarket Signal Source & Navigation Improvements",
    changes: [
      {
        category: "new",
        items: [
          "Polymarket is now a live signal source (weight 2.0). Each harvest searches Polymarket prediction markets for all tracked tickers — both the default scan list and any symbols discovered by other sources that run. Markets matching price keywords (close, above, below, hit) or catalyst keywords (earnings, merger, FDA approval, S&P 500 inclusion, IPO, launch) are captured as signals.",
          "Catalyst detection: Polymarket markets about upcoming earnings, mergers, FDA decisions, or index additions are treated as early-signal catalysts — exactly the pre-breakout events the scoring model looks for. A ticker with a prediction market in play before consensus means smart money is pricing in a move.",
          "Two-phase harvest: Phase 1 scans the standard symbol list in parallel with all other sources. Phase 2 automatically scans any new symbols discovered by Reddit, Twitter, or other sources in that same run — so Polymarket coverage expands dynamically without requiring those symbols to be pre-listed.",
          "Four new signal fields persisted: market probability (implied yes/no or best bracket probability), 24h volume, total liquidity, and market end date. These are passed to the AI scorer and stored in the database.",
        ],
      },
      {
        category: "new",
        items: [
          "Export watchlist to CSV: an 'Export watchlist' button now appears in the dashboard header when you have bookmarked tickers. Downloads a Symbol-column CSV compatible with Interactive Brokers TWS, Schwab, Fidelity, Webull, and most other brokers — import it directly as a watchlist without re-entering tickers.",
        ],
      },
      {
        category: "improved",
        items: [
          "Clicking the SignalScope logo in the sidebar now navigates to the landing page instead of the dashboard.",
          "Landing page nav adapts to login state: logged-in users see Dashboard and Sign Out links instead of Register.",
        ],
      },
    ],
  },
  {
    date: "2026-03-28",
    title: "Deeper Reddit & Twitter Harvesting, ML Model Alignment, API & Docs Audit",
    changes: [
      {
        category: "new",
        items: [
          "Google Analytics 4 conversion tracking: login, subscription page views, checkout initiation, purchase, cancellation, and payment failure events now feed GA4 for revenue funnel analysis.",
        ],
      },
      {
        category: "improved",
        items: [
          "Twitter alert tweets now have personality — a dry, one-liner hook line between the headline and data block conveys stage and tone (e.g. 'New Signal. Nobody's screaming about this one yet.' or 'Everything lines up. Rare, but real.'). Hook is deterministic per ticker so the same symbol always gets the same voice. Promo tweets updated to use a lightly snarky, self-aware tone in AI generation.",
          "Reddit harvester now fetches hot posts (top 25) in addition to new and rising, giving each subreddit three signal angles. Comment fetches are deduplicated across all sorts so the same thread is never fetched twice.",
          "Reddit harvester paginates new posts across up to 3 pages for WSB and 2 pages for stocks/pennystocks — up to 3× more signals per harvest run.",
          "Flair-based velocity weighting: DD and News posts receive a signal boost; Meme, YOLO, and Gain/Loss posts are down-weighted. Daily threads and megaposts are deprioritized.",
          "Twitter/X harvester now filters retweets (-is:retweet), eliminating duplicate content while retaining engagement metrics captured on original tweets.",
          "Twitter/X harvester paginates using next_token across up to 3 pages per harvest (configurable via X_MAX_PAGES, max 5) — up to 3× more tweets analysed per run.",
          "P&D filter thresholds and flag return numbers updated to new Mar 2026 backtesting dataset: micro_cap_no_catalyst is now −5.2% avg 7d (was −4.3%), penny_price is +3.3% (was +3.8%), OTC listing is +1.7% (was +1.3%). Bullish informational flags (penny price, OTC listing, Twitter coordinated pump) now display as green badges in ticker detail.",
          "Scoring prompt updated with new ML feature rankings: hist_source_max is now the #1 positive predictor — tickers with historically broad source coverage get a boost. Prior appearances (#2 negative) and rising signal fraction (#4 positive) rankings corrected. Multi-source boost (+2.4% for 2 sources, +2.8% for 3+) made explicit.",
          "Stage logic: social-only tickers with 6+ prior appearances are now capped at Emerging stage — frequent repeaters without a catalyst source have demonstrably worse 7d returns per ML data.",
        ],
      },
      {
        category: "fixed",
        items: [
          "Email alerts no longer exclude tickers with informational P&D flags (penny price, OTC listing) — these flags predict positive returns and should not gate alerts.",
          "API skill docs corrected: network endpoint parameter is minCorrelation (not minWeight), related endpoint returns correlationScore/correlationDataPoints (not coOccurrenceCount), report response includes catalyst/risks/recommendation fields, performance response field is dailyReturns (not cumulativeReturns), scans/signals/methodology endpoints are fully public.",
          "FAQ corrected: subscription model ($10/mo Pro tier for API keys, on-demand reports, email alerts), snapshot schedule (3×/day not 2×), harvest timing (8:30 AM ET, ~1h before open), ML model (RidgeCV not XGBoost), P&D filter effective vs informational flag distinction.",
          "Landing page corrected: ML backtesting references updated from XGBoost to RidgeCV, snapshot schedule updated to 3×/day, Methodology page link updated to reflect it is now publicly accessible.",
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
