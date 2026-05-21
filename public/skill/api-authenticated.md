# SignalScope Authenticated API

These endpoints manage user account data (portfolio, watchlist, profile, API keys). They require an API key or active session — x402 micropayments are not accepted here.

```
x-api-key: sk_sig_your_key_here
```

Generate your API key at localhost:3000/profile.
Rate limits: free plan 10 calls/calendar month; Pro plan 1,000 calls/day.

### Opportunity score vs signal confidence (AI)

Same definitions as [public API docs](api-public.md#opportunity-score-vs-signal-confidence-ai): `opportunityScore` = early-mover / setup rank; `aiScore` = evidence strength (not expected upside). Authenticated ticker payloads include both where the underlying row is a `ValidatedTicker`.

---

## Portfolio

### GET /api/portfolio

List all positions (open and closed).

**Response:** `{ positions: [{ id, symbol, entryPrice, shares, notes, status, closePrice, openedAt, closedAt, verified, currentPrice, gainPct }] }`

Notes:
- Open positions are enriched with live `currentPrice`.
- `gainPct` is computed server-side from `entryPrice` vs `currentPrice`.

### POST /api/portfolio

Add a new position.

**Body:** `{ symbol: string, entryPrice: number, shares?: number, notes?: string }`

**Response (201):** `{ position: { id, symbol, entryPrice, shares, notes, status, verified, openedAt } }`

Constraints:
- `symbol` is normalized to uppercase, max length 10
- `entryPrice` must be positive
- `shares` (if provided) must be positive
- `notes` (if provided) max length is 500

Verification behavior:
- `verified` is set by comparing the submitted price to the latest snapshot price.
- If no snapshot exists yet for the symbol, the position is accepted as verified.

### PATCH /api/portfolio/:id

Update a position. To close: set `status: "CLOSED"` with `closePrice`.

**Body:** `{ status?: "OPEN" | "CLOSED", closePrice?: number, entryPrice?: number, shares?: number, notes?: string }`

**Response:** `{ position: { ... } }`

Validation rules:
- `closePrice` can only be set when `status` is `CLOSED`
- `closePrice` is required when `status` is `CLOSED`
- Reopening with `status: "OPEN"` clears `closedAt` and `closePrice`

### DELETE /api/portfolio/:id

Delete a position.

**Response:** `{ success: true }`

---

## Watchlist

### GET /api/watchlist

List watchlist items.

**Response:** `{ watchlist: [{ symbol, createdAt }] }`

### POST /api/watchlist

Add to watchlist (idempotent).

**Body:** `{ symbol: string }`

**Response (201):** `{ success: true }`

### DELETE /api/watchlist/:symbol

Remove from watchlist.

**Response:** `{ success: true }`

### GET /api/watchlist/tickers

Watchlist symbols enriched with latest ticker data, performance, and signal sources.

**Response:** `{ tickers: [{ symbol, name, aiScore, opportunityScore, stage, price, marketCap, catalyst, recommendation, report, signalCount, sourceCount, return7d, sources, ... }] }` — full latest validated row per symbol ([two scores](api-public.md#opportunity-score-vs-signal-confidence-ai)).

---

## Performance

### GET /api/performance

Platform-wide ticker performance breakdown.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | number | 7 | Return period: 1, 3, 7, or 30 |

**Response:** `{ summary, cohorts, dailyReturns, overall, confirmed, emerging, byStage, byType, byScoreRange, byOpportunityScoreRange, bestPerformers, worstPerformers }` — `byScoreRange` buckets returns by **AI confidence** (`aiScore`); `byOpportunityScoreRange` buckets by **Opportunity** (`opportunityScore`). Same horizon as `days`. Performer rows include `aiScore` (confidence at detection). See [two scores](api-public.md#opportunity-score-vs-signal-confidence-ai).

---

## Stats

### GET /api/stats

Platform-wide statistics.

**Response:** `{ scans: number, signals: number, tickers: number }`

---

## Prices

### GET /api/prices

Current prices for symbols (cached 5 min).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| symbols | string | required | Comma-separated symbols (max 50) |

**Response:** `{ prices: { "AAPL": 185.50, "INVALID": null } }`

Notes:
- Authentication is optional; unauthenticated requests are accepted
- Missing `symbols` query parameter returns `400`
- Maximum of 50 symbols per request

---

## User Profile

### GET /api/user/profile

Get current user profile.

**Response:** `{ id, email, username, emailAlerts, subscription: { status, plan, currentPeriodEnd, cancelAtPeriodEnd } | null }` — `subscription` is `null` when no active Stripe subscription exists.

### PATCH /api/user/profile

Update profile settings.

**Body:** `{ username?: string, emailAlerts?: boolean }`

Username: 3-20 chars, lowercase letters, numbers, underscores only.

**Response:** `{ id, email, username, emailAlerts }`

---

## API Key Management

### GET /api/user/api-key

Get metadata for your current API key (does not reveal the key itself).

**Response:** `{ apiKey: { prefix, createdAt, lastUsedAt } | null }`

### POST /api/user/api-key

Generate a new API key. Revokes any existing key. The full key is shown only once.

**Response:** `{ key: "sk_sig_...", prefix: "sk_sig_abcdef...", skill: "http://localhost:3000/skill/SKILL.md" }`

### DELETE /api/user/api-key

Revoke your current API key.

**Response:** `{ success: true }`

---

## Common pitfalls

- Closing a position without `closePrice` fails validation (`400`).
- Supplying `closePrice` without `status: "CLOSED"` also fails validation.
- Symbols are normalized to uppercase in portfolio and watchlist endpoints.
- `/api/prices` uses a 5-minute server cache; immediate repeated reads may return cached data.
- These endpoints do not accept x402 payments — use an API key or session.
