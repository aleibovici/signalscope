# SignalScope Authenticated API

All endpoints require the `x-api-key` header:
```
x-api-key: sk_sig_your_key_here
```

## Portfolio

### GET /api/portfolio

List all positions (open and closed).

**Response:** `{ positions: [{ id, symbol, entryPrice, shares, notes, status, closePrice, openedAt, closedAt, verified, currentPrice, gainPct }] }`

### POST /api/portfolio

Add a new position.

**Body:** `{ symbol: string, entryPrice: number, shares?: number, notes?: string }`

**Response (201):** `{ position: { id, symbol, entryPrice, shares, notes, status, verified, openedAt } }`

### PATCH /api/portfolio/:id

Update a position. To close: set `status: "CLOSED"` with `closePrice`.

**Body:** `{ status?: "OPEN" | "CLOSED", closePrice?: number, entryPrice?: number, shares?: number, notes?: string }`

**Response:** `{ position: { ... } }`

### DELETE /api/portfolio/:id

Delete a position.

**Response:** `{ success: true }`

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

**Response:** `{ tickers: [{ symbol, name, aiScore, stage, price, marketCap, catalyst, recommendation, report, signalCount, sourceCount, return7d, sources, ... }] }`

## Leaderboard

> **Temporarily disabled** — returns 503. Will be re-enabled once there are more active users.

## Performance

### GET /api/performance

Platform-wide ticker performance breakdown.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | number | 7 | Return period: 1, 3, 7, or 30 |

**Response:** `{ overall: { count, winRate, avgReturn }, confirmed: { count, winRate, avgReturn }, byStage, byType, byScoreRange, bestPerformers: [{ symbol, return, aiScore, stage, detectionPrice, currentPrice }], worstPerformers: [...] }`

## Search

### GET /api/search

Search tickers by symbol or name.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| q | string | required | Search query (1-20 chars) |

**Response:** `{ results: [{ symbol, aiScore, stage, price }] }`

Returns up to 8 results.

## Stats

### GET /api/stats

Platform-wide statistics.

**Response:** `{ scans: number, signals: number, tickers: number, users: number }`

## Prices

### GET /api/prices

Current prices for symbols (cached 5 min).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| symbols | string | required | Comma-separated symbols (max 50) |

**Response:** `{ prices: { "AAPL": 185.50, "INVALID": null } }`

## User Profile

### GET /api/user/profile

Get current user profile.

**Response:** `{ id, email, username, emailAlerts }`

### PATCH /api/user/profile

Update profile settings.

**Body:** `{ username?: string, emailAlerts?: boolean }`

Username: 3-20 chars, lowercase letters, numbers, underscores only.

**Response:** `{ id, email, username, emailAlerts }`

## API Key Management

### GET /api/user/api-key

Get metadata for your current API key (does not reveal the key itself).

**Response:** `{ apiKey: { prefix, createdAt, lastUsedAt } | null }`

### POST /api/user/api-key

Generate a new API key. Revokes any existing key. The full key is shown only once.

**Response:** `{ key: "sk_sig_...", prefix: "sk_sig_abcdef...", skill: "https://signalscopes.com/skill/SKILL.md" }`

### DELETE /api/user/api-key

Revoke your current API key.

**Response:** `{ success: true }`
