# SignalScope

SignalScope is a stock breakout signal detection platform. It ingests multi-source market signals, scores opportunities with AI, filters pump-and-dump patterns, and serves validated tickers through dashboard UI and API endpoints.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript 5
- PostgreSQL + Prisma 7
- TanStack React Query + Zod validation
- Auth.js v5 (session auth), Bearer JWT for mobile, and API key auth

## Key Codepaths

- `src/lib/harvester/` - signal collection, aggregation, AI scoring, and P&D filtering
- `src/app/api/` - API routes used by web UI, mobile clients, and scheduler jobs
- `src/app/(dashboard)/` - authenticated product UI (signals, ticker detail, portfolio, watchlist, paper trading)
- `src/hooks/` - frontend data-access hooks (React Query)
- `src/lib/paper-trading-returns.ts` + `src/lib/spy-benchmark.ts` - simulated P&L marks and SPY benchmark for `GET /api/paper-trading`
- `public/skill/` - API docs used by agent clients ([Opportunity vs AI confidence](public/skill/api-public.md#opportunity-score-vs-signal-confidence-ai); `GET /api/methodology` returns `scoreComparison` JSON for the same)

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (`DATABASE_URL`, `AUTH_SECRET`, AI provider keys, and optional scheduler keys).
3. Start PostgreSQL (Docker is supported):
   ```bash
   docker compose up db
   ```
4. Generate Prisma client and run migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
5. Run the app:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000`.

## Portfolio + Price Workflow (recently updated)

### Add position from ticker detail page

- UI entrypoint: `src/app/(dashboard)/ticker/[symbol]/page.tsx` (`+ Position` button)
- Modal: `src/components/dashboard/add-position-modal.tsx`
- Payload path: `useAddPosition()` -> `POST /api/portfolio`
- Current modal behavior: only `entryPrice` is collected; symbol is inherited from the current ticker context.

### Position verification behavior

- `POST /api/portfolio` and `PATCH /api/portfolio/:id` call `verifyPriceAgainstSnapshot()`.
- A position is marked `verified: true` when the submitted price is within 5% of the latest snapshot for that symbol.
- If no snapshot exists, verification defaults to `true` (no baseline to compare against).

### Price refresh behavior

- Portfolio page refresh button (`src/app/(dashboard)/portfolio/page.tsx`) triggers React Query `refetch()` of `GET /api/portfolio`.
- `GET /api/portfolio` fetches current prices for open symbols and computes `gainPct` server-side.
- Ticker detail card refresh button calls `GET /api/prices?symbols=...` and shows a `live` badge when refreshed data is present.

### Paper trading (simulated book)

- UI: `src/app/(dashboard)/paper-trading/page.tsx`; data: `src/hooks/use-paper-trading.ts` → `GET /api/paper-trading?minScore=…` (allowed: 60, 70, 80, 90; default 70).
- API: `src/app/api/paper-trading/route.ts` builds one synthetic $1,000 leg per distinct symbol from recent `TickerPerformance` (validated ticker AI score ≥ threshold, stage not FILTERED/UNSCORED, no corporate-action flag). Marks use `src/lib/paper-trading-returns.ts` (7d hold / snapshot horizons); aggregate return is compared to SPY over the same calendar window via `src/lib/spy-benchmark.ts`.

## API Constraints Worth Remembering

- `addPositionSchema`:
  - `symbol`: 1-10 chars, normalized to uppercase
  - `entryPrice`: positive number
  - `shares`: optional positive number
  - `notes`: optional, max 500 chars
- `updatePositionSchema`:
  - closing requires both `status: "CLOSED"` and `closePrice`
  - `closePrice` cannot be set unless status is `CLOSED`
- `GET /api/prices`:
  - requires `symbols` query param
  - accepts 1-50 comma-separated symbols
  - in-memory cache TTL is 5 minutes

## Quality Checks

```bash
npm run lint
npm test
```

## Troubleshooting

- **401 on authenticated routes**: ensure session, Bearer token, or `x-api-key` is present.
- **Validation error when closing a position**: include `closePrice` with `status: "CLOSED"`.
- **Price appears stale**: `GET /api/prices` uses a 5-minute server cache.
- **Unexpectedly verified position**: if no snapshot exists for a symbol, verification intentionally returns `true`.
