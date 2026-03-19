# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is SignalScope

SignalScope is a stock breakout signal detection platform. It harvests signals from multiple sources (Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, volume spikes), scores them with AI, filters pump-and-dump candidates, and presents validated tickers in a dashboard with portfolio tracking.

## Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Run Vitest unit tests (499 tests, 31 files)
npm run test:watch       # Vitest watch mode
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

Snapshots (price tracking — runs via Cloud Scheduler on Cloud Run):
```bash
# Manual trigger:
curl -X POST https://signalscopes.com/api/snapshots/collect -H "x-snapshot-key: <SNAPSHOT_API_KEY>"
# Or via Cloud Scheduler:
gcloud scheduler jobs run signalscope-snapshots --location=us-central1
```

## Tech Stack

- **Next.js 16** (App Router, standalone output) + **React 19** + **TypeScript 5**
- **PostgreSQL** with **Prisma 7** ORM (PrismaPg native adapter)
- **TanStack React Query** for data fetching (60s staleTime, refetchOnWindowFocus disabled)
- **Zod 4** for validation
- **Tailwind CSS 4**
- **Auth.js v5** (next-auth@beta) with Credentials provider, JWT session strategy, bcryptjs for password hashing
- **Dual AI providers**: OpenAI (GPT-4o) and Anthropic (Claude 3.5 Sonnet) with per-call-point override and fallback

## Architecture

### Signal Harvesting Pipeline (`src/lib/harvester/`)

```
Sources (7 in parallel) → Aggregate by symbol → Fetch fundamentals for ALL symbols (Yahoo Finance)
  ↓ candidates (≥2 signals / sources / weighted score)        ↓ non-candidates with YF price
  AI Scoring → P&D Filter (11 flags + AI edge-case)          Heuristic score + P&D flags (no AI)
  → stage: EARLY/FORMING/CONFIRMED/FILTERED                       → stage: UNSCORED
  └──────────────────────────────── DB ───────────────────────────────────────┘
  Reports + Trade Setups generated ON-DEMAND when users view ticker detail page
  (or batch pre-generated for top 10 EARLY/FORMING tickers via POST /api/reports/generate)
```

- `index.ts` — `fetchSignals()` (source fetching), `processSignals()` (AI scoring, P&D filter, DB writes — no report generation); includes `extractTxIdsFromUrls()` and `deduplicateCongressSignals()` for Congress dedup
- `sources/` — reddit, twitter, stocktwits, sec-insider, congress, volume-spike, options-flow
- `sources/ticker-utils.ts` — Shared ticker regex, blacklist, mega-caps, extraction functions
- `scoring.ts` — AI batch scoring with hard-rule overrides
- `pnd-filter.ts` — Pump & dump detection (statistical flags + AI fallback)
- `fundamentals.ts` — Yahoo Finance v8 for price/market cap
- `report.ts` — AI-generated ticker reports + trade setups (on-demand via `POST /api/tickers/[symbol]/report`, or batch via `POST /api/reports/generate`)

Entry point: `scripts/run-harvest-remote.ts` — Fetches signals locally, POSTs to Cloud Run (`/api/harvest/ingest`) for processing

### Email Alerts (`src/lib/email/`)

- `index.ts` — `sendTickerAlerts()` sends a digest of CONFIRMED tickers via Resend. Requires `RESEND_API_KEY` env var; silently skipped if absent.
- Triggered by `POST /api/alerts/send` (authenticated via `x-snapshot-key` header, same as snapshots)
- Users can opt out via `User.emailAlerts = false` (set in profile)

### Utility Libs

- `src/lib/reconstruct-aggregated.ts` — Reconstructs `AggregatedSymbol`, `FundamentalData`, `NoveltyContext` from DB records (shared by on-demand and batch report endpoints)
- `src/lib/cache.ts` — `TTLCache<T>` in-memory cache with max-entries eviction
- `src/lib/rate-limit.ts` — IP-based rate limiting for auth endpoints; `getClientIP()` handles `X-Forwarded-For` for Cloud Run
- `src/lib/price-verification.ts` — `verifyPriceAgainstSnapshot()` validates user-reported prices against latest `PriceSnapshot` (5% deviation threshold)
- `src/lib/co-occurrence.ts` — `getCoOccurringSymbols()`, `getPairwiseEdges()`, `jaccardScore()` — co-occurrence queries and Jaccard similarity for ticker connections

### AI Provider System (`src/lib/ai/`)

- `config.ts` resolves provider per call point (scoring, pnd, report) via env vars
- `chatJSON()` in `index.ts` wraps calls with primary/secondary fallback and cost tracking
- Override per call point: `AI_PROVIDER_SCORING`, `AI_PROVIDER_PND`, `AI_PROVIDER_REPORT`

### API Routes (`src/app/api/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/scans` | GET | List scans (paginated) |
| `/api/scans/[scanId]` | GET | Scan detail with validated tickers |
| `/api/signals` | GET | Signals filtered by scanId and stage |
| `/api/tickers/trending` | GET | Cross-scan trending tickers (query: `minAppearances`, `stage`, `trend`) — **x402: $0.01** |
| `/api/tickers/[symbol]` | GET | Latest ticker + raw signals — **x402: $0.005** |
| `/api/tickers/[symbol]/history` | GET | Historical appearances for a ticker — **x402: $0.005** |
| `/api/tickers/[symbol]/performance` | GET | Performance data for a ticker — **x402: $0.005** |
| `/api/tickers/[symbol]/related` | GET | Co-occurring tickers with Jaccard correlation scores — **x402: $0.005** |
| `/api/tickers/network` | GET | Network graph nodes and edges for ticker co-occurrence — **x402: $0.01** |
| `/api/tickers/[symbol]/report` | POST | Generate AI report + trade setup on-demand (cached after first generation) — **x402: $0.05** |
| `/api/portfolio` | GET/POST | List or add positions |
| `/api/portfolio/[id]` | PATCH/DELETE | Update or delete position |
| `/api/watchlist` | GET/POST | List or add watchlist items |
| `/api/watchlist/tickers` | GET | Watchlist symbols with latest ticker data and sources |
| `/api/watchlist/[symbol]` | DELETE | Remove from watchlist |
| `/api/prices` | GET | Current prices for given symbols (query: `symbols`) |
| `/api/search` | GET | Search tickers by symbol/name (public, no auth) |
| `/api/stats` | GET | Platform-wide stats (scan counts, ticker counts) |
| `/api/performance` | GET | Portfolio performance over time (query: `days`) |
| `/api/user/profile` | GET/PATCH | Get or update current user profile |
| `/api/user/api-key` | GET/POST/DELETE | Manage API key (get metadata, generate, revoke) |
| `/api/health` | GET | Health check |
| `/api/indexnow` | GET | IndexNow SEO submission endpoint |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js handlers (login/logout/session) |
| `/api/auth/login` | POST | Mobile login — returns access + refresh tokens |
| `/api/auth/refresh` | POST | Rotate refresh token, issue new access token |
| `/api/auth/logout` | POST | Revoke refresh tokens (all or by deviceId) |
| `/api/auth/register` | POST | User registration — returns user + tokens |
| `/api/methodology` | GET | Methodology data (public, structured JSON) |
| `/api/alerts/send` | POST | Send email alerts for CONFIRMED tickers via Resend (x-snapshot-key auth) |
| `/api/harvest/ingest` | POST | Receive raw signals for cloud processing (x-harvest-key auth) |
| `/api/reports/generate` | POST | Batch pre-generate AI reports for top 10 emerging tickers (x-snapshot-key auth) |
| `/api/snapshots/collect` | POST | Collect price snapshots for validated tickers (x-snapshot-key auth) |

### Frontend (`src/app/(dashboard)/`)

Dashboard pages: signals (main), trending, connections, portfolio, ticker detail, performance, methodology, profile. Uses route group `(dashboard)` with shared sidebar layout. (`/subscription` directory exists but has no page yet.)

Public pages (no auth): `/changelog` — statically rendered changelog page (`src/app/changelog/page.tsx`). Data in `src/lib/changelog-data.ts` (same pattern as `methodology-data.ts`). Linked from dashboard sidebar (with "NEW" badge for 14 days after latest entry) and landing page footer.

Methodology page data is in `src/lib/methodology-data.ts` (shared between the page component and `GET /api/methodology`). Includes ML backtesting description and pipeline data (`backtestDescription`, `backtestPipeline`).

Landing page (`src/app/(auth)/login/page.tsx`) doubles as the public marketing page with hero, features grid, "How It Works" pipeline, signal sources, ML backtesting section, Agent Skill / API section, and footer. The login form is embedded in the hero section.

All data fetching hooks are in `src/hooks/` using TanStack Query mutations/queries.

### Auth (`src/lib/auth.ts`, `src/lib/auth.config.ts`)

Multi-user email/password auth via Auth.js v5 (Credentials provider, JWT sessions). Mobile clients use Bearer token auth.

- `auth.config.ts` — Edge-safe config (no Node.js deps), imported by middleware; `trustHost: true` required for Cloud Run reverse proxy
- `auth.ts` — Full NextAuth instance with Prisma + bcrypt `authorize()`, exports `auth`, `handlers`, `getCurrentUserId()`
- `getCurrentUserId()` is **async** — all callers must `await` it; checks `Authorization: Bearer` header first (mobile JWT), then `x-api-key` header (API key auth), falls back to Auth.js cookie session
- `mobile-jwt.ts` — HS256 JWT sign/verify via `jose`, signing key `"mobile:" + AUTH_SECRET` (cryptographically separate from Auth.js), 15min access token expiry, opaque 64-hex-char refresh tokens (DB-backed, 30-day expiry, rotation on use)
- `src/proxy.ts` (middleware) — Protects dashboard routes (redirect to `/login`) and `/api/portfolio/**`, `/api/watchlist/**`, `/api/user/**` (401 JSON); requests with `Authorization: Bearer` or `x-api-key` headers bypass middleware auth (verified in route handlers); matcher allows `.txt`/`.xml` static files through
- Public routes: `/login`, `/register`, `/changelog`, `/api/auth/**`, `/api/health`, `/api/alerts/**`, `/api/harvest/**`, `/api/snapshots/**`, `/api/reports/**`
- Auth pages use route group `(auth)` with centered layout (no sidebar)
- `SessionProvider` wrapped in `src/lib/session-provider.tsx`, added to root layout
- Type augmentations in `src/types/next-auth.d.ts` (adds `id` and `role` to Session/JWT)
- Seed user: `user@signalscope.dev` / `password123`

#### Mobile Auth Flow

1. `POST /api/auth/login` with `{ email, password, deviceId? }` → returns `{ accessToken, refreshToken, expiresIn, user }`
2. Use `Authorization: Bearer <accessToken>` on all protected routes
3. When access token expires (15min), call `POST /api/auth/refresh` with `{ refreshToken }` → returns new token pair (rotation)
4. `POST /api/auth/logout` revokes refresh tokens (requires Bearer auth)
5. `POST /api/auth/register` also returns tokens for seamless register-and-go

### x402 Payment Protocol (`src/lib/x402.ts`)

Anonymous pay-per-call access for AI agents via the [x402 protocol](https://www.x402.org). Agents pay in USDC on Base (L2) — no registration or API key needed. Coexists with existing auth: if request has session/Bearer/API key, normal auth is used; otherwise x402 validates payment or returns HTTP 402 with payment requirements.

- `src/lib/x402.ts` — Shared x402 server config, route configs, `hasAuthCredentials()` helper
- Monetized endpoints: `GET /api/tickers/trending` ($0.01), `GET /api/tickers/network` ($0.01), `GET /api/tickers/[symbol]` ($0.005), `GET /api/tickers/[symbol]/related` ($0.005), `GET /api/tickers/[symbol]/history` ($0.005), `GET /api/tickers/[symbol]/performance` ($0.005), `POST /api/tickers/[symbol]/report` ($0.05)
- Public (no auth, no payment): `GET /api/search` — free discovery endpoint to drive agents toward paid ticker endpoints
- Middleware (`src/proxy.ts`) bypasses auth for x402 paths so route handlers can return 402 payment details
- Enabled when `X402_WALLET_ADDRESS` env var is set; disabled (normal auth only) when absent
- Facilitator: `https://facilitator.x402.org` (Coinbase-hosted, testnet-only for Base Sepolia; production facilitators at x402.org/ecosystem)
- Payment settles to wallet on Base mainnet (`eip155:8453`), scheme: `exact` (EIP-3009 USDC `transferWithAuthorization`)
- Packages: `@x402/next`, `@x402/core`, `@x402/evm`, `viem`

### Database Models

Key models in `prisma/schema.prisma`: **User** (with `emailAlerts: Boolean`), **Scan** (harvest run), **Signal** (raw from sources), **ValidatedTicker** (scored candidates with fundamentals/report), **TickerPerformance** (post-scan price performance tracking), **PriceSnapshot** (continuous price time-series for return computation), **UserPosition** (portfolio), **UserWatchlist** (bookmarked tickers), **RefreshToken** (mobile auth token rotation, indexed on token/userId/expiresAt), **ApiKey** (SHA-256 hashed API keys for programmatic access, single key per user, `sk_sig_` prefix).

`ValidatedTicker` notable fields: `wk52Lo/wk52Hi` (52-week range), `firstSeenDaysAgo` (null = truly novel, 0 = first seen today, N = days ago), `priorAppearances` (count of prior appearances in 30d window), `exchange`, `aiReasoning`, `pndFlagged/pndFlags/pndScore/pndAiConfidence/pndAiReasoning`, `tradeSetupEntryLo/EntryHi/StopLoss/Target1/Target2/Timeframe/RiskReward/Confidence` (AI trade setup, generated on-demand for Buy/Strong Buy recommendations).

`SignalSource` enum: `REDDIT | TWITTER | STOCKTWITS | SEC_INSIDER | SEC_FILING | CONGRESS | OPTIONS_FLOW | VOLUME_SPIKE`

Signal stages: `EARLY | FORMING | CONFIRMED | FILTERED | UNSCORED`

`UNSCORED` — non-candidate symbols (single mention, low weight) that have a Yahoo Finance price. Heuristic-scored only (no AI calls). Used for backtesting negative examples. Excluded from dashboard and trending queries.

## Environment Variables

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AUTH_SECRET=<openssl rand -base64 32>

# Optional: X/Twitter API (skipped if not set, ~$9/day at 6 runs/day)
X_BEARER_TOKEN=...
X_MAX_TWEETS_PER_RUN=300

# Optional: mirror harvest writes to local dev DB
DATABASE_URL_DEV=postgresql://postgres:postgres@host.docker.internal:5432/signalscope

# Optional per-call-point AI provider override (openai or anthropic):
AI_PRIMARY_PROVIDER=openai
AI_PROVIDER_SCORING=anthropic
AI_PROVIDER_PND=anthropic
AI_PROVIDER_REPORT=anthropic

# Harvester (fetches locally, processes on Cloud Run)
HARVEST_ENDPOINT_URL=https://signalscopes.com/api/harvest/ingest
HARVEST_API_KEY=<openssl rand -base64 32>

# Snapshots (Cloud Scheduler → Cloud Run)
SNAPSHOT_API_KEY=<openssl rand -base64 32>

# Optional: Email alerts via Resend (no emails sent if absent)
RESEND_API_KEY=re_...

# Optional: x402 payment protocol (USDC on Base, disabled if absent)
X402_WALLET_ADDRESS=0x...

# Optional: SEO site verification meta tags
GOOGLE_SITE_VERIFICATION=...
BING_SITE_VERIFICATION=...
```

## GCP Deployment

### Architecture

- **Cloud Run** — web app (`signalscope-web`) serving Next.js standalone on port 3000
- **Cloud SQL** — PostgreSQL 16 (`signalscope-db`, db-f1-micro), connected via Unix socket
- **Cloud Scheduler** — 4 jobs: email alerts (9:15 AM ET), snapshots open (9:30 AM ET), snapshots close (4:05 PM ET), reports (3:30 AM NZDT Tue-Sat), all weekdays
- **Secret Manager** — stores `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SNAPSHOT_API_KEY`, `RESEND_API_KEY`
- **Artifact Registry** — Docker images (`signalscope` repo)
- **GitHub Actions** — CI/CD on push to `main` (`.github/workflows/deploy.yml`)
- **Workload Identity Federation** — keyless GitHub Actions → GCP auth

### Harvester

Reddit blocks cloud IPs, so signal **fetching** runs locally. Processing (AI scoring, P&D filter, DB writes) runs on Cloud Run via `POST /api/harvest/ingest`. Reports and trade setups are generated on-demand when users view tickers.

- **Dockerfile**: `Dockerfile.harvester` (lightweight, no Cloud SQL proxy)
- **Compose file**: `docker-compose.harvest.yml`
- **Cron schedule**: `0 3 * * 2-6` (once daily, 30 min before market open — 9:00 AM ET = 3:00 AM NZDT next day, Tue-Sat local)
- **Auth**: `x-harvest-key` header checked against `HARVEST_API_KEY` env var (stored in Secret Manager on Cloud Run)
- **Retry**: one automatic retry on failure; on total failure, saves signals to `/tmp/signalscope-harvest-{timestamp}.json` for manual replay

```bash
docker compose -f docker-compose.harvest.yml --env-file .env.production run --rm harvester
```

### Snapshots (`src/lib/snapshots/`)

Continuous price tracking for all validated tickers, runs on Cloud Run triggered by Cloud Scheduler (no local Docker needed).

- **How it works**: Every run creates a `PriceSnapshot` row for every ticker within 30 days of detection. Returns (1d, 3d, 7d, 30d) are computed from the snapshot time-series by finding the closest snapshot to each target period within tolerance windows. This ensures all tickers eventually have data for all return periods.
- **Return computation**: `returns.ts` — pure function `computeReturnsFromSnapshots()` with tolerance windows (1d: 18–48h, 3d: 54–120h, 7d: 120–264h, 30d: 600–888h) to handle weekends/holidays. Always picks the snapshot closest to target time. Returns improve as more snapshots accumulate.
- **Collector**: `index.ts` — `collectSnapshots()` fetches prices via Yahoo Finance in batches of 50, creates `PriceSnapshot` rows, recomputes returns, and upserts `TickerPerformance`.
- **Endpoint**: `POST /api/snapshots/collect` (auth via `x-snapshot-key` header)
- **Cloud Scheduler jobs** (all weekdays):
  - `signalscope-snapshots` — `30 9 * * 1-5` America/New_York (9:30 AM ET, 30 min after market open)
  - `signalscope-snapshots-close` — `5 16 * * 1-5` America/New_York (4:05 PM ET, 5 min after market close)
  - `signalscope-reports` — `30 3 * * 2-6` Pacific/Auckland (3:30 AM NZDT, 30 min after harvest)
- **Auth**: `x-snapshot-key` header checked against `SNAPSHOT_API_KEY` env var (stored in Secret Manager)

```bash
# Create Cloud Scheduler jobs:
gcloud scheduler jobs create http signalscope-snapshots \
  --location=us-central1 \
  --schedule="30 9 * * 1-5" \
  --time-zone="America/New_York" \
  --uri="https://signalscopes.com/api/snapshots/collect" \
  --http-method=POST \
  --headers="x-snapshot-key=<SNAPSHOT_API_KEY_VALUE>" \
  --attempt-deadline=300s \
  --description="Collect opening price snapshots for validated tickers"

gcloud scheduler jobs create http signalscope-snapshots-close \
  --location=us-central1 \
  --schedule="5 16 * * 1-5" \
  --time-zone="America/New_York" \
  --uri="https://signalscopes.com/api/snapshots/collect" \
  --http-method=POST \
  --headers="x-snapshot-key=<SNAPSHOT_API_KEY_VALUE>" \
  --attempt-deadline=300s \
  --description="Collect closing price snapshots for validated tickers"

gcloud scheduler jobs create http signalscope-reports \
  --location=us-central1 \
  --schedule="30 3 * * 2-6" \
  --time-zone="Pacific/Auckland" \
  --uri="https://signalscopes.com/api/reports/generate" \
  --http-method=POST \
  --headers="x-snapshot-key=<SNAPSHOT_API_KEY_VALUE>" \
  --attempt-deadline=600s \
  --description="Pre-generate AI reports for top 10 emerging tickers after harvest"
```

### Source Status

| Source | Status | Notes |
|--------|--------|-------|
| Reddit | Active | Uses `old.reddit.com` JSON, sequential with 1.5s delay, browser UA |
| X/Twitter | Active | X API v2 Recent Search (api.x.com), single keyword query, requires Basic tier ($200/mo) — Free tier returns 403, requires `X_BEARER_TOKEN` |
| SEC Insider | Active | OpenInsider HTML + EDGAR RSS, filters C-suite $50K+ purchases |
| Congress | Active | CapitolTrades.com — congressional stock trades; deduplicates by transaction ID across runs |
| Volume Spike | Active | Yahoo Finance, 110 symbols, 2x avg volume threshold |
| StockTwits | Active | Uses TrendSpider mirror (server-side rendered); direct StockTwits access is Cloudflare-blocked |
| Options Flow | Active | Yahoo Finance options chain API, scans SCAN_SYMBOLS for unusual call volume, OTM activity, and call sweeps |

### Initial Setup

```bash
# 1. Fill in .env.production with GCP project ID, API keys, etc.
# 2. Run provisioning (creates Cloud SQL, Cloud Run, secrets, WIF, sets GitHub vars)
bash scripts/gcp-setup.sh

# 3. Run Prisma migrations via Cloud SQL Auth Proxy
cloud_sql_proxy -instances=PROJECT:REGION:signalscope-db=tcp:5433 &
DATABASE_URL="postgresql://signalscope:PASS@localhost:5433/signalscope" npx prisma migrate deploy
DATABASE_URL="postgresql://signalscope:PASS@localhost:5433/signalscope" npm run db:seed

# 4. Push to main to trigger first CI/CD deploy
git push origin main
```

### CI/CD

Push to `main` → GitHub Actions builds web image and pushes to Artifact Registry (`CI — Build & Push` workflow). To deploy to Cloud Run, manually trigger the `Deploy to Cloud Run` workflow.

**IMPORTANT**: Always wait for the `CI — Build & Push` workflow to complete successfully before triggering `Deploy to Cloud Run`. The deploy pulls the latest image from Artifact Registry, so deploying before the build finishes will deploy the previous image. Use `gh run list --workflow="CI — Build & Push" --limit 1` to check build status.

```bash
# 1. Wait for build to finish
gh run list --workflow="CI — Build & Push" --limit 1
# 2. Then deploy
gh workflow run "Deploy to Cloud Run" --ref main
```

## Tests

**Vitest** (v4.0.18) with `@vitest/coverage-v8`. Config: `vitest.config.ts` at project root. Tests in `src/__tests__/`.

| File | Coverage |
|------|---------|
| `ticker-utils.test.ts` | `extractTickers`, `extractCashtagTickers`, BLACKLIST, MEGA_CAPS |
| `pnd-filter.test.ts` | `checkPndFlags` — all 11 flag types + threshold logic |
| `ai-config.test.ts` | `resolveProviderOrder` — env var overrides, fallback logic |
| `ai-chatjson.test.ts` | `chatJSON` — primary/fallback, cost tracking |
| `cost-tracker.test.ts` | Cost accumulation and reporting |
| `aggregate-signals.test.ts` | `aggregateSignals` — velocity, momentum, sorting |
| `api-error.test.ts` | `handleApiError` — status code mapping |
| `validators.test.ts` | Zod schemas — pagination, portfolio, watchlist, symbols |
| `scoring.test.ts` | `scoreSymbolBatch` heuristic fallback (chatJSON mocked to fail) |
| `scoring-cap.test.ts` | Post-AI social-only score cap enforcement (chatJSON mocked to return inflated scores) |
| `twitter-cashtags.test.ts` | Twitter cashtag entity extraction + regex merging + deduplication |
| `fundamentals.test.ts` | Yahoo Finance data extraction — sector, earningsDate, floatShares, graceful handling |
| `mobile-jwt.test.ts` | `signAccessToken`/`verifyAccessToken` — sign, verify, expired, tampered, payload preservation |
| `login-endpoint.test.ts` | `POST /api/auth/login` — happy path, wrong password (401), rate limiting (429), validation (400), deviceId passthrough |
| `refresh-endpoint.test.ts` | `POST /api/auth/refresh` — token rotation, expired (401), revoked (401), non-existent (401), rate limiting (429) |
| `snapshot-returns.test.ts` | `computeReturnsFromSnapshots` — all 4 periods, tolerance windows, weekend gaps, closest-match selection, progressive improvement, penny stocks, non-overlapping windows |
| `trending-endpoint.test.ts` | `GET /api/tickers/trending` — empty results, response shape, trend computation (rising/falling/stable), trend filter, validation (minAppearances/stage/trend), sorting, pagination, summary before pagination, error handling |
| `congress-dedup.test.ts` | `extractTxIdsFromUrls()` and `deduplicateCongressSignals()` — URL parsing, dedup logic |
| `fetch-signals.test.ts` | `fetchSignals()` with all 7 sources including Congress |
| `harvest-ingest-endpoint.test.ts` | `POST /api/harvest/ingest` — auth, signal ingestion |
| `price-verification.test.ts` | `verifyPriceAgainstSnapshot()` — 5% deviation threshold, snapshot lookup |
| `stage-logic.test.ts` | `determineStage()` — novel/recurring tickers, Reddit subreddit consensus, novelty boost |
| `co-occurrence.test.ts` | `jaccardScore` pure function — identical sets, disjoint sets, partial overlap, symmetry |
| `related-endpoint.test.ts` | `GET /api/tickers/[symbol]/related` — empty results, co-occurrence counts, Jaccard computation, stage filtering, pagination, auth (401), validation (400) |
| `network-endpoint.test.ts` | `GET /api/tickers/network` — node/edge structure, symbol-centered vs trending-based, minWeight filtering, maxNodes cap, auth (401) |

Key gotchas:
- `BUY` is NOT in BLACKLIST (but `SELL`, `HOLD` are)
- TICKER_REGEX is `{1,5}` — 6+ char words never match
- P&D threshold: `flags.length >= 3` to flag as pump-and-dump
- `coordinated_posts`: duplicateRatio = `1 - uniqueTitles/totalTitles >= 0.5`

## Agent Skill

Claude Agent Skill files are served from `public/skill/` (accessible at `https://signalscopes.com/skill/`):

- `SKILL.md` — Main skill file with overview, auth, key concepts, workflow examples, error handling
- `api-public.md` — Signal & scan API reference (9 endpoints); includes **Opportunity score vs signal confidence (AI)** — `opportunityScore` = early-mover rank, `aiScore` = evidence strength (not expected upside)
- `api-authenticated.md` — Account API reference (12 endpoints: portfolio, watchlist, performance, profile); performance aggregates include `byScoreRange` (AI) and `byOpportunityScoreRange` (Opportunity)

`GET /api/methodology` returns `scoreComparison` with the same explanations for programmatic use.

API key auth uses SHA-256 hashed keys stored in the `ApiKey` model. Key format: `sk_sig_<48 hex chars>`. Single key per user with revoke-and-replace flow. Profile page UI at `/profile` allows generating, viewing metadata, and revoking keys.

## SEO

All SEO metadata lives in Next.js metadata exports. When adding features, update descriptions across all files to stay consistent:

- `src/app/layout.tsx` — Root metadata (title, description, keywords, openGraph, twitter, JSON-LD structured data)
- `src/app/(auth)/login/layout.tsx` — Login page meta (description, OG)
- `src/app/(auth)/register/layout.tsx` — Register page meta (description, OG)
- `src/app/opengraph-image.tsx` — Dynamic OG image (rendered at build time)
- `src/app/manifest.ts` — PWA manifest (name, description)
- `src/app/sitemap.ts` — XML sitemap (public pages only)
- `src/app/robots.ts` — robots.txt (allows `/`, `/login`, `/register`, `/skill/`; disallows dashboard/API)
- `src/lib/changelog-data.ts` — Changelog entries (array of `ChangelogEntry`). Add new entries at the top; `latestChangelogDate` export drives the sidebar "NEW" badge automatically. **One entry per date** — if today already has an entry, merge new changes into it instead of creating a duplicate.

## API Error Handling

All authenticated API routes use `handleApiError()` from `src/lib/api-error.ts` (or try/catch with proper status codes):
- 401 for auth failures (`getCurrentUserId()` throws "Not authenticated")
- 400 for Zod validation errors (with `details` containing issues)
- 500 for unexpected errors (logged via `console.error` for Cloud Run log inspection)

## DB Extract Script (`scripts/extract.py`)

Python script that pulls `ValidatedTicker` + `TickerPerformance` + raw `Signal` aggregates from production PostgreSQL into a local parquet file. Used by the external ML harness.

```bash
# Requires: pip install psycopg2-binary pandas pyarrow python-dotenv
# Reads DB_PASSWORD from .env.production
python scripts/extract.py
# Output: scripts/output/dataset.parquet
```

- Auto-starts/stops Cloud SQL Auth Proxy on port 5434
- Read-only — only SELECTs, never writes

## Backtesting Experiment Log (`scripts/backtesting-experiments.md`)

Tracks ML model runs from the external backtesting harness. Each row is one experiment with its commit hash, date, performance metrics, and a description of what changed. The purpose is to track research progress over time — as the dataset grows and the model improves, this log shows which changes moved the needle and informs fine-tuning of the pipeline filters (score thresholds, stage logic, P&D flags, etc.).

**Rules when adding entries:**
- **Never add a duplicate** — if a commit hash already exists in the table, skip it. The commit hash is the unique identifier.
- Add new rows at the bottom (chronological order).
- `status: keep` = this experiment improved or matched the best result and is worth building on. `status: discard` = regression or noise, reverted.
- The `features` column in the source data can be long — summarize to top features only in `top_features`.

## Deploy Workflow

When the user says "deploy" or "deploy to production", execute these steps in order:

1. **Update changelog** — Add major new features/improvements to `src/lib/changelog-data.ts`
2. **Lint** — Run `npm run lint` and fix any issues
3. **Test** — Run `npm test` and ensure all tests pass
4. **Commit** — Stage and commit all changes
5. **Push** — `git push origin main` (always push the commits to remote)
6. **Deploy** — Wait for `CI — Build & Push` workflow to complete, then trigger `Deploy to Cloud Run` workflow

## Path Alias

`@/*` maps to `./src/*`
