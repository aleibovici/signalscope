# Deploying SignalScope

SignalScope has no cloud-provider dependencies. It needs three things:

1. **A PostgreSQL 16+ database** — anything that gives you a `postgresql://` URL.
2. **A place to run a Node 22 container** (or a plain Node process).
3. **A scheduler** for the recurring jobs, if you want snapshots, alerts, or automation.

Everything else (AI providers, Stripe, Resend, brokers, X/Twitter, analytics) is
optional and disabled when its environment variables are absent.

## Contents

- [Run it locally](#run-it-locally)
- [Run it with Docker Compose](#run-it-with-docker-compose)
- [Run it on any container host](#run-it-on-any-container-host)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Scheduled jobs](#scheduled-jobs)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [Provider notes](#provider-notes)

## Run it locally

No Docker required beyond Postgres (use a local install if you prefer).

```bash
cp .env.example .env          # set AUTH_SECRET and one AI provider key
docker compose up db -d       # or point DATABASE_URL at your own Postgres
npm install
npm run db:generate
npm run db:migrate
npm run db:seed               # local admin: dev@localhost / password123
npm run dev
```

The seed refuses to run against a non-local database host unless you set
`SEED_ALLOW_REMOTE=1`, so you cannot accidentally create an admin account in
production.

## Run it with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, applies migrations via the one-shot `migrate` service, and
then starts the web app on `http://localhost:3000`. Optional keys in `.env` are
passed through to the container automatically.

Requires Docker Compose v2.24+ (for the optional `env_file` syntax).

Run the harvester against it:

```bash
docker compose --profile harvest run --rm harvester
```

## Run it on any container host

`Dockerfile` produces a self-contained Next.js standalone image that listens on
`$PORT` (default 3000) and needs no build-time secrets beyond a syntactically
valid `DATABASE_URL`.

```bash
docker build -t signalscope .
docker run -p 3000:3000 --env-file .env signalscope
```

That image runs unchanged on Kubernetes, Docker Swarm, Nomad, a plain VM with
systemd, Fly.io, Render, Railway, Google Cloud Run, AWS App Runner / ECS, Azure
Container Apps, or anything else that can run an OCI container.

Without Docker: `npm ci && npx prisma generate && npm run build && npm start`.

## Environment variables

`.env.example` is the complete list, with each variable annotated. The only
required ones:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js signing secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used for absolute links and SEO |
| `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` | AI scoring and reports |

Tuning knobs worth knowing:

- `DATABASE_POOL_MAX` — Postgres connections per app instance (default 5).
  Multiply by your instance count and stay under your server's `max_connections`.
- `APP_REVISION` — build identifier shown in the dashboard footer. Cloud Run,
  Render, Railway, Vercel, Fly.io and Heroku are detected automatically.
- `AUTH_URL` — pin the canonical URL when running behind a reverse proxy.

## Database migrations

Migrations are plain Prisma migrations against PostgreSQL:

```bash
npx prisma migrate deploy    # production / CI
npm run db:migrate           # development (creates new migrations)
```

The Compose `migrate` service runs `prisma migrate deploy` before `web` starts.
On other hosts, run it as a release/init step.

## Scheduled jobs

Recurring work is exposed as HTTP endpoints guarded by a shared secret, so any
scheduler can drive them. Set `SNAPSHOT_API_KEY` and send it as `x-snapshot-key`.

| Job | Endpoint | Suggested schedule |
|-----|----------|--------------------|
| Price snapshots + returns | `POST /api/snapshots/collect` | Daily after market close |
| AI report generation | `POST /api/reports/generate` | After each harvest |
| Portfolio alerts | `POST /api/alerts/portfolio` | Daily |
| Weekly digest email | `POST /api/alerts/weekly-digest` | Weekly |
| Broker sync + time exits | `POST /api/brokers/ibkr/sync` | Every 15 min during market hours |
| Promo tweets | `POST /api/tweets/promo` | 3x daily |
| Performance tweets | `POST /api/tweets/performance` | Daily |
| Follow automation | `POST /api/twitter/follow` | Daily |
| IndexNow submission | `POST /api/indexnow` (`x-cron-secret`) | On content change |

With plain cron:

```cron
0 21 * * 1-5 curl -fsS -X POST -H "x-snapshot-key: $SNAPSHOT_API_KEY" https://your-host.example/api/snapshots/collect
```

Kubernetes `CronJob`, systemd timers, GitHub Actions `schedule`, or a managed
scheduler (Cloud Scheduler, EventBridge, Azure Logic Apps) all work the same way.

Snapshots can also run as a local process without exposing an endpoint:

```bash
npm run snapshots
```

The harvester is scheduled separately — see `scripts/harvest-cron.sh` (set
`HARVEST_ENV_FILE` to choose an env file).

## Behind a reverse proxy

`trustHost` is enabled, so Auth.js honours forwarded headers. Make sure your
proxy sets `X-Forwarded-For` and `X-Forwarded-Proto`, and set `AUTH_URL` to the
canonical origin. The rate limiter reads the second-to-last `X-Forwarded-For`
entry, which assumes exactly one trusted proxy in front of the app.

Requests to a `www.` host are 301-redirected to the apex host by the middleware.

## Provider notes

Nothing below is required — these are conveniences for specific hosts.

**Google Cloud SQL.** `scripts/extract.py` and `scripts/pg_perf.py` read
`DATABASE_URL` by default. If your instance is only reachable through the Cloud
SQL Auth Proxy, pass `--cloud-sql-proxy` and set `GCP_PROJECT_ID`,
`GCP_INSTANCE_NAME`, and `DB_PASSWORD`. The proxy binary must be on `PATH`.

**Managed Postgres (RDS, Neon, Supabase, Azure Database, ...).** Use the
provider's connection string. Add `?sslmode=require` when the provider requires
TLS, and keep `DATABASE_POOL_MAX` under the plan's connection limit.

**Serverless / autoscaling hosts.** The in-memory rate limiter is per-instance,
so effective limits scale with instance count. The API-key monthly quota is
enforced in Postgres and is unaffected.
