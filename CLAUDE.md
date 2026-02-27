# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is SignalScope

SignalScope is a stock breakout signal detection platform. It harvests signals from multiple sources (Reddit, StockTwits, SEC insider filings, options flow, volume spikes), scores them with AI, filters pump-and-dump candidates, and presents validated tickers in a dashboard with portfolio tracking.

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
Sources (5 in parallel) → Aggregate by symbol → Fetch fundamentals (Yahoo Finance)
→ AI Scoring → P&D Filter (9 flags + AI edge-case assessment) → Report Generation → DB
```

- `index.ts` — `orchestrateScan()` main orchestrator
- `sources/` — reddit, stocktwits (disabled), sec-insider, options-flow (disabled), volume-spike
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

- `auth.config.ts` — Edge-safe config (no Node.js deps), imported by middleware
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
- **Cron schedule**: `0 */4 * * *` (every 4 hours, local crontab)
- **Cloud Scheduler**: paused (was `signalscope-harvest-schedule`)

```bash
# Manual run
docker compose -f docker-compose.harvest.yml --env-file .env.production run --rm harvester

# Check logs
tail -f /tmp/signalscope-harvest.log
```

### Source Status

| Source | Status | Notes |
|--------|--------|-------|
| Reddit | Active | Uses `old.reddit.com` JSON, sequential with 1.5s delay, browser UA |
| SEC Insider | Active | OpenInsider HTML + EDGAR RSS, filters C-suite $50K+ purchases |
| Volume Spike | Active | Yahoo Finance, 110 symbols, 2x avg volume threshold |
| StockTwits | Disabled | Cloudflare blocks all direct access |
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

Push to `main` → GitHub Actions builds both images, pushes to Artifact Registry, deploys web to Cloud Run, and updates the harvester job image.

## Path Alias

`@/*` maps to `./src/*`
