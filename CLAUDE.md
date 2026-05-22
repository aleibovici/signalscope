# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is SignalScope

SignalScope is a stock breakout signal detection platform. It harvests signals from multiple sources (Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, volume spikes), scores them with AI, filters pump-and-dump candidates, and presents validated tickers in a dashboard with portfolio tracking.

## Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Run Vitest unit tests (~930 tests, 55 files)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest with coverage report
npm run db:generate      # Generate Prisma client (run after schema changes)
npm run db:migrate       # Run Prisma migrations (dev)
npm run db:seed          # Seed database with default user (user_1)
npm run harvest          # Run signal harvester scan (requires HARVEST_ENDPOINT_URL + HARVEST_API_KEY)
npm run snapshots        # Trigger price snapshot collection (requires SNAPSHOT_API_KEY)
```

Docker (local dev):
```bash
docker compose up db         # PostgreSQL only
docker compose up            # Web app + DB
```

Docker (production harvester — fetches locally, processes on Cloud Run):
```bash
docker compose -f docker-compose.harvest.yml --env-file .env.production run --rm harvester
```

## Tech Stack

- **Next.js 16** (App Router, standalone output) + **React 19** + **TypeScript 5**
- **PostgreSQL** with **Prisma 7** ORM (PrismaPg native adapter)
- **TanStack React Query** for data fetching (60s staleTime, refetchOnWindowFocus disabled)
- **Zod 4** for validation
- **Tailwind CSS 4**
- **Auth.js v5** (next-auth@beta) with Credentials provider, JWT session strategy, bcryptjs
- **Dual AI providers**: OpenAI (GPT-4o / GPT-4o-mini) and Anthropic (Claude Sonnet 4 `claude-sonnet-4-20250514` / Haiku 4.5 mini `claude-haiku-4-5-20251001`) with per-call-point override and fallback

## Architecture

### Signal Harvesting Pipeline (`src/lib/harvester/`)

```
Sources (8 in parallel) → Aggregate by symbol → Fetch fundamentals for ALL symbols (Yahoo Finance)
  ↓ candidates (≥2 signals / sources / weighted score)        ↓ non-candidates with YF price
  AI Scoring → P&D Filter (11 flags + AI edge-case)          Heuristic score + P&D flags (no AI)
  → stage: EARLY/FORMING/CONFIRMED/FILTERED                       → stage: UNSCORED
  └──────────────────────────────── DB ───────────────────────────────────────┘
  Reports + Trade Setups generated ON-DEMAND when users view ticker detail page
  (or batch pre-generated for top 10 EARLY/FORMING tickers via POST /api/reports/generate)
  ↓ AI writes catalyst/risks/report prose; recommendation (Strong Buy/Buy/Watch/Avoid)
    is computed deterministically server-side from aiScore + stage + sources + P&D flags
```

- `index.ts` — `fetchSignals()` (source fetching), `processSignals()` (AI scoring, P&D filter, DB writes); includes `extractTxIdsFromUrls()` and `deduplicateCongressSignals()` for Congress dedup
- `sources/` — reddit, twitter, stocktwits, sec-insider, congress, volume-spike, options-flow (includes `computeNetPremium()` for call/put dollar flow), polymarket
- `sources/ticker-utils.ts` — Shared ticker regex, blacklist, mega-caps, extraction functions
- `scoring.ts` — AI batch scoring with hard-rule overrides
- `pnd-filter.ts` — Pump & dump detection (statistical flags + AI fallback)
- `fundamentals.ts` — Yahoo Finance v8 for price/market cap
- `report.ts` — AI-generated ticker report prose (catalyst, risks, narrative) + trade setup entry range. On-demand via `POST /api/tickers/[symbol]/report`, batch via `POST /api/reports/generate`. The `recommendation` label is computed deterministically server-side via `recommendation.ts` (not picked by the LLM); target/stop are anchored via `anchors.ts`
- `recommendation.ts` — `deriveRecommendation()` pure function mapping (`aiScore`, `stage`, `sourceCount`, `hasCatalystSource`, `pndFlagged`, `price`, `medianSignalAgeHrs`) → `Strong Buy | Buy | Watch | Avoid`. Thresholds calibrated against `TickerPerformance` via `scripts/calibrate-recommendation.ts`. `RECOMMENDATION_RULE_VERSION` bumps when semantics change

Entry point: `scripts/run-harvest-remote.ts` — Fetches signals locally, POSTs to Cloud Run (`/api/harvest/ingest`) for processing

### Twitter/X (`src/lib/twitter/`)

- **`post.ts`** — OAuth 1.0a tweet posting (X API v2 free tier). `composeTweet()` formats top emerging tickers into 280-char tweet. Integrated into `POST /api/reports/generate` — tweets top 5 Buy/Strong Buy/Watch tickers after report generation.
- **`performance.ts`** — Proof-based tweets ("We flagged $XYZ 7 days ago — up 23%"). `findTopPerformers()` queries TickerPerformance for tickers exceeding return thresholds (5% 1d, 8% 3d, 10% 7d, 15% 30d). Skips `corporateActionDetected = true`. Endpoint: `POST /api/tweets/performance`.
- **`follow.ts`** — Automated follow/unfollow: seed accounts + harvest signal authors → follow 5/run, unfollow 3 stale (30+ days, no follow-back). `keep: true` prevents auto-unfollow. Rate limit: 5 follows per 15-min window. DB: `TwitterFollow` model. Endpoint: `POST /api/twitter/follow`.

### Email Alerts (`src/lib/email/`)

- `index.ts` — `sendTickerAlerts()` sends CONFIRMED tickers digest via Resend. Only to users with active subscriptions. Triggered by `POST /api/alerts/send`.
- `weekly-digest.ts` — `sendWeeklyDigest()` free weekly email to ALL users with `emailAlerts=true`. Top 3 tickers + recent winners. Free users get upgrade CTA. Triggered by `POST /api/alerts/weekly-digest`.

### Key Utility Libs

- `src/lib/reconstruct-aggregated.ts` — Reconstructs `AggregatedSymbol`, `FundamentalData`, `NoveltyContext` from DB records (shared by report endpoints)
- `src/lib/cache.ts` — `TTLCache<T>` in-memory cache with max-entries eviction
- `src/lib/rate-limit.ts` — IP-based rate limiting; `getClientIP()` handles `X-Forwarded-For` for Cloud Run
- `src/lib/price-verification.ts` — `verifyPriceAgainstSnapshot()` validates prices against latest `PriceSnapshot` (5% deviation threshold)
- `src/lib/co-occurrence.ts` — `getCoOccurringSymbols()`, `getPairwiseEdges()`, `jaccardScore()` for ticker connections
- `src/lib/spy-benchmark.ts` — `fetchSpyTotalReturnDecimal()` loads SPY adj. close bars from Yahoo Finance; cached ~45m via `TTLCache`
- `src/lib/analytics.ts` — `trackEvent()` pushes to GTM dataLayer; **use `trackConversion` (with `await`) whenever the next line navigates away** so pixel requests complete before page unloads
- `src/lib/votes.ts` — `getAggregates()`, `getUserVotes()`, `computeDecayWeight()` — ticker community voting with 45-day exponential half-life; cached 60s
- `src/lib/score-explainer.ts` — shared callout copy for Opportunity Score vs AI Score explanation (used across dashboard, trending, performance, methodology, connections)
- `src/lib/share-reward.ts` — Share & Earn: tweet about SignalScope → Stripe trial extension; `buildTweetIntentUrl()`
- `src/lib/price-correlation.ts` — `pearsonCorrelation()` for price return data
- `src/lib/stage-labels.ts` — `STAGE_LABELS` map: `EARLY`→`"Emerging"`, `FORMING`→`"Building"`, `CONFIRMED`→`"Consensus"` (DB enum ≠ display label)
- `src/lib/validators.ts` — shared Zod schemas: `paginationSchema`, `symbolsQuerySchema`
- `src/lib/username-generator.ts` — auto-generates display usernames on registration
- `src/lib/ga4-server.ts` — server-side GA4 event tracking (complements client GTM)

### AI Provider System (`src/lib/ai/`)

- `config.ts` resolves provider per call point (scoring, pnd, report, promo) via env vars
- `chatJSON()` in `index.ts` wraps calls with primary/secondary fallback and cost tracking
- Override per call point: `AI_PROVIDER_SCORING`, `AI_PROVIDER_PND`, `AI_PROVIDER_REPORT`, `AI_PROVIDER_PROMO`

### API Routes (`src/app/api/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/scans` | GET | List scans (paginated) |
| `/api/scans/[scanId]` | GET | Scan detail with validated tickers |
| `/api/signals` | GET | Signals filtered by scanId and stage |
| `/api/tickers/trending` | GET | Cross-scan trending tickers — **x402: $0.01** |
| `/api/tickers/[symbol]` | GET | Latest ticker + raw signals — **x402: $0.005** |
| `/api/tickers/[symbol]/history` | GET | Historical appearances — **x402: $0.005** |
| `/api/tickers/[symbol]/performance` | GET | Performance data — **x402: $0.005** |
| `/api/tickers/[symbol]/related` | GET | Co-occurring tickers with Jaccard scores — **x402: $0.005** |
| `/api/tickers/network` | GET | Network graph nodes/edges — **x402: $0.01** |
| `/api/tickers/[symbol]/report` | POST | Generate AI report + trade setup on-demand — **x402: $0.05** |
| `/api/portfolio` | GET/POST | List or add positions |
| `/api/portfolio/[id]` | PATCH/DELETE | Update or delete position |
| `/api/watchlist` | GET/POST | List or add watchlist items |
| `/api/watchlist/tickers` | GET | Watchlist symbols with latest ticker data and sources |
| `/api/watchlist/[symbol]` | DELETE | Remove from watchlist |
| `/api/prices` | GET | Current prices for given symbols |
| `/api/search` | GET | Search tickers (public, no auth) |
| `/api/stats` | GET | Platform-wide stats |
| `/api/performance` | GET | Portfolio performance over time |
| `/api/user/profile` | GET/PATCH | Get or update user profile |
| `/api/user/api-key` | GET/POST/DELETE | Manage API key |
| `/api/users/export` | GET | Export email-opted-in users as JSON or CSV — `?format=csv` (x-snapshot-key auth) |
| `/api/votes` | GET | Community vote aggregates for symbols (`?symbols=A,B`); POST to cast a vote — optional auth |
| `/api/admin/costs` | GET | AI cost log summary (7d, 30d, all-time) — `role: admin` only |
| `/api/admin/payments` | GET | Stripe payment/subscription summary — `role: admin` only |
| `/api/admin/stats` | GET | Platform stats for admin — `role: admin` only |
| `/api/admin/users` | GET | User list — `role: admin` only |
| `/api/admin/x-usage` | GET | X/Twitter API credit usage — `role: admin` only |
| `/api/apple/verify` | POST | Apple In-App Purchase receipt verification |
| `/api/apple/webhook` | POST | Apple App Store Server notification webhook |
| `/api/health` | GET | Health check |
| `/api/indexnow` | GET | IndexNow SEO submission |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js handlers |
| `/api/auth/login` | POST | Mobile login — returns access + refresh tokens |
| `/api/auth/refresh` | POST | Rotate refresh token |
| `/api/auth/logout` | POST | Revoke refresh tokens |
| `/api/auth/register` | POST | User registration — returns tokens |
| `/api/methodology` | GET | Methodology data (public) |
| `/api/alerts/send` | POST | Send email alerts (x-snapshot-key auth) |
| `/api/harvest/ingest` | POST | Receive raw signals for cloud processing (x-harvest-key auth) |
| `/api/reports/generate` | POST | Batch pre-generate AI reports (x-snapshot-key auth) |
| `/api/snapshots/collect` | POST | Collect price snapshots (x-snapshot-key auth) |
| `/api/tweets/post` | POST | Tweet top emerging tickers (x-snapshot-key auth) |
| `/api/tweets/performance` | POST | Tweet performance proof thread (x-snapshot-key auth) |
| `/api/twitter/follow` | POST | Automated follow/unfollow job (x-snapshot-key auth) |
| `/api/alerts/weekly-digest` | POST | Free weekly email digest (x-snapshot-key auth) |
| `/api/paper-trading/ibkr` | GET | Live IBKR paper portfolio — public, no auth |
| `/api/brokers/ibkr/sync` | POST | Sync IBKR order fills + positions, time-based exits (x-snapshot-key auth) |
| `/api/stripe/checkout` | POST | Create Stripe Checkout session (authenticated) |
| `/api/stripe/portal` | POST | Create Stripe Customer Portal session (authenticated) |
| `/api/stripe/webhook` | POST | Stripe webhook handler (signature-verified) |

### Frontend (`src/app/(dashboard)/`)

Dashboard pages: signals (main), trending, connections, portfolio, paper trading (`/results/paper-trading` — live Alpaca paper account, table + aggregates vs SPY), ticker detail, performance, methodology, subscription, profile, `/admin` (role-gated admin dashboard), `/results/signal-quality` and `/results/simulated-portfolio` (backtesting result views). Route group `(dashboard)` with shared sidebar layout.

Public pages: `/changelog` — statically rendered (`src/app/changelog/page.tsx`), data in `src/lib/changelog-data.ts`. Linked from sidebar with "NEW" badge for 14 days after latest entry.

Methodology page data in `src/lib/methodology-data.ts` (shared with `GET /api/methodology`). Landing page (`src/app/(auth)/login/page.tsx`) doubles as marketing page with embedded login form.

All data fetching hooks in `src/hooks/` using TanStack Query.

### Auth (`src/lib/auth.ts`, `src/lib/auth.config.ts`)

Multi-user email/password auth via Auth.js v5. Mobile clients use Bearer token auth.

- `auth.config.ts` — Edge-safe config; `trustHost: true` required for Cloud Run reverse proxy
- `auth.ts` — Full NextAuth instance; exports `auth`, `handlers`, `getCurrentUserId()`, `getOptionalUserId()`
- `getCurrentUserId()` is **async** — all callers must `await` it; checks `Authorization: Bearer` (mobile JWT) → `x-api-key` → Auth.js cookie session; throws 401 if unauthenticated
- `getOptionalUserId()` — same lookup chain but returns `string | null` instead of throwing; use for routes that work for both guests and logged-in users (e.g. votes)
- `mobile-jwt.ts` — HS256 JWT via `jose`, signing key `"mobile:" + AUTH_SECRET`, 15min access tokens, 30-day refresh tokens (DB-backed, rotation on use)
- `src/proxy.ts` (middleware) — Protects dashboard routes and `/api/portfolio/**`, `/api/watchlist/**`, `/api/user/**`; Bearer/x-api-key bypass middleware (verified in route handlers)
- Public routes: `/login`, `/register`, `/changelog`, `/api/auth/**`, `/api/health`, `/api/alerts/**`, `/api/harvest/**`, `/api/snapshots/**`, `/api/reports/**`
- Seed user: `user@signalscope.dev` / `password123`

### x402 Payment Protocol (`src/lib/x402.ts`)

Anonymous pay-per-call access for AI agents via USDC on Base (L2). Coexists with auth: session/Bearer/API key uses normal auth; otherwise x402 validates or returns HTTP 402.

- Enabled when `X402_WALLET_ADDRESS` env var is set
- Payment settles on Base mainnet (`eip155:8453`), scheme: `exact` (EIP-3009 USDC)
- Packages: `@x402/next`, `@x402/core`, `@x402/evm`, `viem`

### Stripe Subscriptions (`src/lib/stripe.ts`, `src/lib/subscription.ts`)

$2.99/mo or $29.99/yr gates: on-demand AI report generation, email alerts. Dashboard and API key access free for all users.

- Enforcement: API key generation open to all. Free plan: 10 calls/calendar month (DB-tracked, resets 1st of month). Pro plan: 1,000 req/day (in-memory). On-demand reports (403 if no existing report), email alerts (subscribers only)
- `PAST_DUE` still allows access; `CANCELED`/`UNPAID` blocks
- Stripe Customer created lazily on first checkout, stored as `User.stripeCustomerId`

### Database Models

Key models in `prisma/schema.prisma`: **User** (`emailAlerts`, `stripeCustomerId`, `role`), **Subscription** (Stripe state), **Scan** (harvest run), **Signal** (raw), **ValidatedTicker** (scored candidates), **TickerPerformance** (post-scan returns), **PriceSnapshot** (price time-series), **UserPosition** (portfolio), **UserWatchlist**, **RefreshToken** (mobile auth), **ApiKey** (`sk_sig_` prefix, SHA-256 hashed), **TwitterFollow** (auto-follow queue), **AiCostLog** (per-call AI cost tracking), **BrokerOrder** / **BrokerPosition** (broker integration state), **PasswordResetToken** (password reset flow), **UserVote** (community ticker votes with timestamps for decay), **X402Payment** (x402 on-chain payment records), **XApiLog** (X/Twitter API credit usage tracking).

`ValidatedTicker` notable fields: `wk52Lo/wk52Hi`, `firstSeenDaysAgo` (null = truly novel), `priorAppearances`, `exchange`, `aiReasoning`, `pndFlagged/pndFlags/pndScore/pndAiConfidence/pndAiReasoning`, `netPremium` (call−put premium $), `callPremiumRatio` (0–1), `tradeSetupEntryLo/EntryHi/StopLoss/Target1/Target2/Timeframe/RiskReward/Confidence`.

`SignalSource` enum: `REDDIT | TWITTER | STOCKTWITS | SEC_INSIDER | SEC_FILING | CONGRESS | OPTIONS_FLOW | VOLUME_SPIKE | POLYMARKET`

Signal stages: `EARLY | FORMING | CONFIRMED | FILTERED | UNSCORED`

`UNSCORED` — single-mention symbols with a YF price. Heuristic-scored only. Excluded from dashboard and trending queries.

## Environment Variables

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AUTH_SECRET=<openssl rand -base64 32>

# Optional: X/Twitter API search (requires Basic tier $200/mo)
X_BEARER_TOKEN=...
X_MAX_TWEETS_PER_RUN=300

# Optional: mirror harvest writes to local dev DB
DATABASE_URL_DEV=postgresql://postgres:postgres@host.docker.internal:5432/signalscope

# Optional per-call-point AI provider override (openai or anthropic):
AI_PRIMARY_PROVIDER=openai
AI_PROVIDER_SCORING=anthropic
AI_PROVIDER_PND=anthropic
AI_PROVIDER_REPORT=anthropic
AI_PROVIDER_PROMO=anthropic

# Harvester
HARVEST_ENDPOINT_URL=https://signalscopes.com/api/harvest/ingest
HARVEST_API_KEY=<openssl rand -base64 32>

# Snapshots
SNAPSHOT_API_KEY=<openssl rand -base64 32>

# Optional: Email alerts via Resend
RESEND_API_KEY=re_...

# Optional: Stripe subscriptions
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...

# Optional: X/Twitter auto-posting
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...

# Optional: x402 payment protocol (USDC on Base)
X402_WALLET_ADDRESS=0x...

# Optional: Alpaca paper trading (single SignalScope-owned account)
ALPACA_API_KEY=<paper account API key from alpaca.markets dashboard>
ALPACA_SECRET_KEY=<paper account API secret>
ALPACA_PAPER=true            # set to false for live account
BROKER_PROVIDER=alpaca       # future: "ibkr" | "tradier"

# Optional: SEO site verification
GOOGLE_SITE_VERIFICATION=...
BING_SITE_VERIFICATION=...
```

## GCP Deployment

### Architecture

- **Cloud Run** — web app (`signalscope-web`), Next.js standalone, port 3000
- **Cloud SQL** — PostgreSQL 16 (`signalscope-db`, db-f1-micro), Unix socket
- **Cloud Scheduler** — weekday ET jobs: reports + Alpaca orders (8:55 AM), email alerts (9:05 AM), portfolio alerts (9:07 AM), snapshots open (9:45 AM), midday (12:30 PM), close (4:05 PM); follow job weekdays (9AM); performance tweet daily (10 AM ET Mon–Fri); weekly digest (Sundays 10 AM ET)
- **Secret Manager** — `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SNAPSHOT_API_KEY`, `RESEND_API_KEY`
- **Artifact Registry** — Docker images (`signalscope` repo)
- **GitHub Actions** — CI/CD on push to `main`; Workload Identity Federation for keyless auth

### Harvester

Reddit blocks cloud IPs, so signal **fetching** runs locally. Processing runs on Cloud Run via `POST /api/harvest/ingest`.

- **Cron**: `scripts/harvest-cron.sh` — runs at 8:30 AM ET Mon–Fri (1 hour before market open)
- **Auth**: `x-harvest-key` header checked against `HARVEST_API_KEY`
- **Retry**: one automatic retry; on failure saves to `/tmp/signalscope-harvest-{timestamp}.json`

### Snapshots (`src/lib/snapshots/`)

Every run creates a `PriceSnapshot` row for all tickers within 30 days of detection. Returns (1d, 3d, 7d, 30d) computed from time-series with tolerance windows (1d: 18–48h, 3d: 54–120h, 7d: 120–264h, 30d: 600–888h) to handle weekends/holidays.

### Source Status

| Source | Status | Notes |
|--------|--------|-------|
| Reddit | Active | `old.reddit.com` JSON, sequential 1.5s delay, browser UA |
| X/Twitter | Degraded | X API v2 Recent Search, requires Basic tier ($200/mo); credits depleted 2026-04-07 |
| SEC Insider | Active | OpenInsider HTML + EDGAR RSS, C-suite $50K+ purchases |
| Congress | Active | CapitolTrades.com, deduplicates by transaction ID |
| Volume Spike | Active | Yahoo Finance, 89 symbols, 2x avg volume threshold |
| StockTwits | Active | TrendSpider mirror (direct access is Cloudflare-blocked) |
| Options Flow | Active | Yahoo Finance options chain, unusual call volume/OTM/sweeps |
| Polymarket | Active | Gamma API, stock price prediction markets with volume spikes |

### CI/CD

**IMPORTANT**: Always wait for `CI — Build & Push` to complete before triggering `Deploy to Cloud Run`. Deploying before build finishes deploys the previous image.

```bash
gh run list --workflow="CI — Build & Push" --limit 1
gh workflow run "Deploy to Cloud Run" --ref main
```

## Tests

**Vitest** (v4.1.x). Config: `vitest.config.ts`. Tests in `src/__tests__/`.

Key gotchas:
- `BUY` is NOT in BLACKLIST (but `SELL`, `HOLD` are)
- TICKER_REGEX is `{1,5}` — 6+ char words never match
- P&D threshold: `flags.length >= 3` to flag as pump-and-dump
- `coordinated_posts`: duplicateRatio = `1 - uniqueTitles/totalTitles >= 0.5`
- DB stage enum values (`EARLY/FORMING/CONFIRMED`) differ from display labels (`Emerging/Building/Consensus`) — see `src/lib/stage-labels.ts`

## Agent Skill

Skill files served from `public/skill/`:
- `SKILL.md` — overview, auth, key concepts, workflow examples
- `api-public.md` — 9 public endpoints; `opportunityScore` = early-mover rank, `aiScore` = evidence strength
- `api-authenticated.md` — 12 authenticated endpoints

API key format: `sk_sig_<48 hex chars>`, SHA-256 hashed in DB. Single key per user. Profile page at `/profile`.

## SEO

Update descriptions across all SEO files when adding features:
- `src/app/layout.tsx` — Root metadata (title, description, keywords, OG, JSON-LD)
- `src/app/(auth)/login/layout.tsx` — Login page meta
- `src/app/(auth)/register/layout.tsx` — Register page meta
- `src/app/opengraph-image.tsx` — Dynamic OG image
- `src/app/manifest.ts` — PWA manifest
- `src/app/sitemap.ts` — XML sitemap (public pages only)
- `src/app/robots.ts` — robots.txt
- `src/lib/changelog-data.ts` — Add new entries at the top; **one entry per date** — merge into existing date entry, never duplicate.

## API Error Handling

All authenticated routes use `handleApiError()` from `src/lib/api-error.ts`:
- 401 for auth failures
- 400 for Zod validation errors (with `details`)
- 500 for unexpected errors (logged via `console.error`)

## DB Extract Script (`scripts/extract.py`)

Dumps every `public` table from production PostgreSQL to parquet under `scripts/output/`. Then `pg_dump`/`pg_restore` into local dev DB (`DATABASE_URL_DEV`). Used by external ML harness.

```bash
# Requires: pip install psycopg2-binary pandas pyarrow python-dotenv
python scripts/extract.py          # full run
python scripts/extract.py --no-restore  # skip dev DB overwrite
```

- Auto-starts/stops Cloud SQL Auth Proxy on port 5434
- Refuses restore targets on port 5434 or Cloud SQL socket URLs
- Output may include sensitive columns; treat `scripts/output/` accordingly

## Backtesting Experiment Log (`scripts/backtesting-experiments.md`)

Tracks ML model runs. Each row: commit hash, date, metrics, description.

- **Never add a duplicate** — commit hash is the unique identifier
- Add new rows at the bottom (chronological)
- `status: keep` = improved/matched best; `status: discard` = regression
- Summarize long `features` columns to top features only

## Deploy Workflow

When the user says "deploy" or "deploy to production":

1. **Update changelog** — Add to `src/lib/changelog-data.ts`
2. **Lint** — `npm run lint`
3. **Test** — `npm test`
4. **Commit** — Stage and commit all changes
5. **Push** — `git push origin main`
6. **Deploy** — Wait for `CI — Build & Push`, then trigger `Deploy to Cloud Run`

## Path Alias

`@/*` maps to `./src/*`
