# AGENTS.md

## Cursor Cloud specific instructions

### Services

| Service | How to start | Notes |
|---------|-------------|-------|
| PostgreSQL 16 | `sudo docker compose up db -d` | Required. Must be running before dev server or migrations. |
| Next.js dev server | `npm run dev` | Port 3000. Requires Prisma client generated and migrations applied. |

### Quick start (after update script has run)

```bash
sudo dockerd &>/tmp/dockerd.log &  # Start Docker daemon (if not already running)
sleep 3
sudo docker compose up db -d       # Start PostgreSQL
npm run db:migrate                  # Apply any new migrations (idempotent)
npm run dev                         # Start dev server on port 3000
```

### Key gotchas

- Docker runs inside a nested container (Firecracker VM). The daemon must be started with `sudo dockerd` and Docker commands need `sudo` unless the user is in the docker group.
- The Docker daemon config at `/etc/docker/daemon.json` uses `fuse-overlayfs` storage driver and `iptables-legacy` — required for this nested environment.
- `npm run db:migrate` is idempotent — safe to run every time.
- Seed user: `user@signalscope.dev` / `password123` (role: admin). Created by `npm run db:seed`.
- Tests (`npm test`) run in pure Node.js with mocks — no database or external services needed.
- The `.env` file is gitignored. Copy from `.env.example` and set `AUTH_SECRET` (via `openssl rand -base64 32`). `DATABASE_URL` default in `.env.example` already points to the docker-compose PostgreSQL.
- AI features (scoring, reports) require `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` env vars but the app starts and serves the dashboard without them.

### Standard commands

See `CLAUDE.md` for the full command reference. Key ones:

- **Lint**: `npm run lint`
- **Test**: `npm test` (Vitest, ~1130 tests, ~6s)
- **Build**: `npm run build`
- **Dev server**: `npm run dev`
