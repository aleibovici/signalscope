# SignalScope

SignalScope is an open-source stock breakout signal detection platform. It harvests signals from multiple sources (Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, volume spikes, options flow, Polymarket), scores them with AI, filters pump-and-dump candidates, and presents validated tickers in a dashboard with portfolio tracking and APIs.

This project was formerly a closed-source hosted product. It is now released under the [MIT License](LICENSE) for self-hosting anywhere (laptop, VPS, Kubernetes, or any cloud).

**Maintainer contact:** use [GitHub Issues](https://github.com/aleibovici/signalscope/issues) and [Security Advisories](https://github.com/aleibovici/signalscope/security). There is no project support mailbox.

## Architecture: web app vs harvester

SignalScope runs as **two processes**:

```text
Signal sources ──► Harvester container ──POST /api/harvest/ingest──► Web app (Next.js)
                                                                      │
                                                                      ▼
                                                                 PostgreSQL
                                                                      │
                                                         Dashboard UI + public/API
```

| Runtime | What it is | Entry points |
|---------|------------|--------------|
| **Web app** | Next.js UI, Auth, REST APIs, AI scoring/P&D on ingest, DB writes, optional scheduled jobs (snapshots, reports, alerts) | `Dockerfile`, `docker compose` service `web`, or `npm run dev` |
| **Harvester** | Separate Node process that **fetches** raw signals from external sources, then POSTs them to the web app ingest endpoint | `Dockerfile.harvester`, compose profile `harvest`, `npm run harvest` → `scripts/run-harvest-remote.ts` |

Why separate? Some sources block datacenter IPs. The harvester can run on a network that can reach those sources while the web app runs on any host. The harvester is **optional** for UI development if you already have data (seed + prior scans).

Auth for ingest: header `x-harvest-key` must match `HARVEST_API_KEY` on the web app. Set `HARVEST_ENDPOINT_URL` on the harvester to your web app’s ingest URL (e.g. `http://localhost:3000/api/harvest/ingest`).

## Repository map

- `src/app/` — App Router UI and API routes
- `src/lib/harvester/` — Signal pipeline (fetch helpers, scoring, P&D, DB write) used by ingest processing
- `scripts/run-harvest-remote.ts` — Harvester entry (fetch locally, POST to web)
- `prisma/` — Schema, migrations, seed
- `public/skill/` — API docs for humans and agent clients
- `docker-compose.yml` — Postgres + web; harvester via `--profile harvest`
- `docker-compose.harvest.yml` — Standalone harvester against a remote ingest URL

## Prerequisites

- Node.js 22+
- Docker (recommended for Postgres)
- At least one AI provider key (`OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`) for scoring and reports

## Quick start (web app + database)

```bash
git clone https://github.com/aleibovici/signalscope.git
cd signalscope
cp .env.example .env
```

Edit `.env` and set at least:

- `AUTH_SECRET` — `openssl rand -base64 32`
- `DATABASE_URL` — default in `.env.example` matches Docker Postgres below
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev
- `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`

```bash
docker compose up db -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

**Local seed login** (credentials provider login id — local only, not a contact address):

- Login id: `dev@localhost`
- Password: `password123`
- Role: admin

Do not use this seed against a shared or production database.

### Docker: web + DB

```bash
docker compose up --build
```

## Running the harvester

1. Web app must be running and reachable from the harvester host.
2. Set the same secret on both sides:

```bash
# on the web app (.env)
HARVEST_API_KEY=<openssl rand -base64 32>

# on the harvester
HARVEST_API_KEY=<same value>
HARVEST_ENDPOINT_URL=http://localhost:3000/api/harvest/ingest
```

Optional source credentials (e.g. `X_BEARER_TOKEN`) improve coverage; many sources work without paid APIs.

**npm (same machine as the repo):**

```bash
npm run harvest
```

**Docker Compose profile (uses `Dockerfile.harvester`):**

```bash
docker compose --profile harvest run --rm harvester
```

**Against a remote web app:**

```bash
docker compose -f docker-compose.harvest.yml --env-file .env run --rm harvester
```

## Optional integrations

All of these are env-gated; omit the vars to disable:

- Stripe subscriptions
- Resend outbound notifications (`RESEND_API_KEY` + `EMAIL_FROM` — you supply a verified sender for your own mail provider; none is bundled)
- x402 pay-per-call (`X402_WALLET_ADDRESS`)
- Broker paper trading (Alpaca, etc.)
- X/Twitter posting and follow automation

## Tests and lint

```bash
npm run lint
npm test
```

## Contributing and security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md) — report vulnerabilities via GitHub Security Advisories

## License

[MIT](LICENSE) — Copyright (c) 2026 SignalScope contributors
