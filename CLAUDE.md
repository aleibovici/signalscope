# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is SignalScope

SignalScope is a stock breakout signal detection platform. It harvests signals from multiple sources (Reddit, X/Twitter, StockTwits, SEC insider filings, options flow, volume spikes), scores them with AI, filters pump-and-dump candidates, and presents validated tickers in a dashboard with portfolio tracking.

## Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:generate      # Generate Prisma client (run after schema changes)
npm run db:migrate       # Run Prisma migrations (dev)
npm run db:seed          # Seed database with default user (user_1)
npm run harvest          # Run signal harvester scan
```

Docker (local dev):
```bash
docker compose up db         # PostgreSQL only
docker compose up            # Web app + DB
docker compose --profile harvest run harvester  # Run harvester (local DB)
```

Docker (production harvester — writes to Cloud SQL):
```bash
docker compose -f docker-compose.harvest.yml --env-file .env.production run --rm harvester
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
Sources (6 in parallel) → Aggregate by symbol → Fetch fundamentals (Yahoo Finance)
→ AI Scoring → P&D Filter (11 flags + AI edge-case assessment) → Report Generation → DB
```

- `index.ts` — `orchestrateScan()` main orchestrator
- `sources/` — reddit, twitter, stocktwits (disabled), sec-insider, options-flow (disabled), volume-spike
- `sources/ticker-utils.ts` — Shared ticker regex, blacklist, mega-caps, extraction functions
- `scoring.ts` — AI batch scoring with hard-rule overrides
- `pnd-filter.ts` — Pump & dump detection (statistical flags + AI fallback)
- `fundamentals.ts` — Yahoo Finance v8 for price/market cap
- `report.ts` — AI-generated ticker reports

Entry point: `scripts/run-harvest.ts`

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
| `/api/tickers/[symbol]` | GET | Latest ticker + raw signals |
| `/api/portfolio` | GET/POST | List or add positions |
| `/api/portfolio/[id]` | PATCH/DELETE | Update or delete position |
| `/api/health` | GET | Health check |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js handlers (login/logout/session) |
| `/api/auth/register` | POST | User registration (email, password, name) |

### Frontend (`src/app/(dashboard)/`)

Dashboard pages: signals (main), portfolio, history, filtered, ticker detail. Uses route group `(dashboard)` with shared sidebar layout.

All data fetching hooks are in `src/hooks/` using TanStack Query mutations/queries.

### Auth (`src/lib/auth.ts`, `src/lib/auth.config.ts`)

Multi-user email/password auth via Auth.js v5 (Credentials provider, JWT sessions).

- `auth.config.ts` — Edge-safe config (no Node.js deps), imported by middleware; `trustHost: true` required for Cloud Run reverse proxy
- `auth.ts` — Full NextAuth instance with Prisma + bcrypt `authorize()`, exports `auth`, `handlers`, `getCurrentUserId()`
- `getCurrentUserId()` is **async** — all callers must `await` it
- `src/middleware.ts` — Protects dashboard routes (redirect to `/login`) and `/api/portfolio/**` (401 JSON)
- Public routes: `/login`, `/register`, `/api/auth/**`, `/api/scans/**`, `/api/signals/**`, `/api/tickers/**`, `/api/health`
- Auth pages use route group `(auth)` with centered layout (no sidebar)
- `SessionProvider` wrapped in `src/lib/session-provider.tsx`, added to root layout
- Type augmentations in `src/types/next-auth.d.ts` (adds `id` and `role` to Session/JWT)
- Seed user: `dev@localhost` / `password123`

### Database Models

Key models in `prisma/schema.prisma`: **User**, **Scan** (harvest run), **Signal** (raw from sources), **ValidatedTicker** (scored candidates with fundamentals/report), **UserPosition** (portfolio).

Signal stages: `EARLY | FORMING | CONFIRMED | FILTERED`

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
```

## GCP Deployment

### Architecture

- **Cloud Run** — web app (`signalscope-web`) serving Next.js standalone on port 3000
- **Cloud SQL** — PostgreSQL 16 (`signalscope-db`, db-f1-micro), connected via Unix socket
- **Secret Manager** — stores `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- **Artifact Registry** — Docker images (`signalscope` repo)
- **GitHub Actions** — CI/CD on push to `main` (`.github/workflows/deploy.yml`)
- **Workload Identity Federation** — keyless GitHub Actions → GCP auth

### Harvester (runs locally)

Reddit blocks cloud IPs, so the harvester runs locally via Docker with an embedded Cloud SQL Auth Proxy. It connects to Cloud SQL directly from the developer's machine.

- **Dockerfile**: `Dockerfile.harvester-local` (includes Cloud SQL proxy)
- **Compose file**: `docker-compose.harvest.yml`
- **Service account key**: `sa-key.json` (gitignored, created by `gcp-setup.sh`)
- **Cron schedule**: `0 3 * * 2-6` (once daily, 30 min before market open — 9:00 AM ET = 3:00 AM NZDT next day, Tue-Sat local)
- **Cloud Scheduler**: removed (Reddit blocks cloud IPs, harvester runs locally only)
- **Dual-database writes**: When `DATABASE_URL_DEV` is set, the harvester mirrors all writes (Scan, Signal, ValidatedTicker) to a second database. Enabled by default in `docker-compose.harvest.yml` pointing at `host.docker.internal:5432`. Dev writes are best-effort — failures log warnings but don't abort the harvest. Requires `docker compose up db` running on the host.

```bash
# Manual run (writes to both production Cloud SQL and local dev DB)
docker compose -f docker-compose.harvest.yml --env-file .env.production run --rm harvester

# Check logs
tail -f /tmp/signalscope-harvest.log
```

### Source Status

| Source | Status | Notes |
|--------|--------|-------|
| Reddit | Active | Uses `old.reddit.com` JSON, sequential with 1.5s delay, browser UA |
| X/Twitter | Active | X API v2 Recent Search (api.x.com), single keyword query, 1 req/15min on pay-per-use, requires `X_BEARER_TOKEN` |
| SEC Insider | Active | OpenInsider HTML + EDGAR RSS, filters C-suite $50K+ purchases |
| Volume Spike | Active | Yahoo Finance, 110 symbols, 2x avg volume threshold |
| StockTwits | Active | Uses TrendSpider mirror (server-side rendered); direct StockTwits access is Cloudflare-blocked |
| Options Flow | Disabled | Requires paid API (Unusual Whales, FlowAlgo) |

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

Push to `main` → GitHub Actions builds web image, pushes to Artifact Registry, and deploys to Cloud Run.

## API Error Handling

All authenticated API routes (`/api/portfolio/**`) use try/catch with proper status codes:
- 401 for auth failures (`getCurrentUserId()` throws "Not authenticated")
- 400 for Zod validation errors (with `details` containing issues)
- 500 for unexpected errors (logged via `console.error` for Cloud Run log inspection)

## Path Alias

`@/*` maps to `./src/*`
