# SignalScope Signal & Scan API

## Access

Most endpoints can be accessed two ways:

**x402 micropayments** (no account required) — pay-per-call in USDC on Base. Send the request; if you receive `402 Payment Required`, decode the `payment-required` header for payment details and retry with `X-PAYMENT` proof. See [SKILL.md](SKILL.md) for the full x402 flow.

**API key** (registered users) — include in all requests:
```
x-api-key: sk_sig_your_key_here
```
Generate your API key at signalscopes.com/profile.

**Free** endpoints (no auth, no payment): `/api/search`, `/api/methodology`, `/api/health`.

---

## GET /api/search — free

Search tickers by symbol or name. No authentication or payment required.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| q | string | required | Search query (1-20 chars) |

**Response:** `{ results: [{ symbol, aiScore, stage, price }] }`

Returns up to 8 results. Use this for free symbol discovery before calling paid endpoints.

---

## GET /api/tickers/trending — $0.01 via x402

Cross-scan trending tickers (last 30 days).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Results per page (max 100) |
| minAppearances | number | 2 | Minimum scan appearances (min 2) |
| stage | string | — | Filter by latest stage: `EARLY`, `FORMING`, `CONFIRMED` |
| trend | string | — | Filter: `rising`, `falling`, `stable` |
| sector | string | — | Filter by sector (e.g., `Technology`, `Healthcare`) |
| marketCap | string | — | Filter by market cap bucket: `micro` (<300M), `small` (300M-2B), `mid` (2B-10B), `large` (10B+) |
| sortBy | string | appearances | Sort: `appearances`, `aiScore`, `price`, `return`, `marketCap` |
| source | string | — | Filter by signal source: `REDDIT`, `TWITTER`, `STOCKTWITS`, `SEC_INSIDER`, `CONGRESS`, `VOLUME_SPIKE`, `OPTIONS_FLOW` |
| hidePnd | boolean | false | Hide pump-and-dump flagged tickers |
| returnPeriod | string | 7d | Return period for sort/display: `1d`, `3d`, `7d`, `30d` |
| near52wLow | boolean | false | Only show tickers within 20% of 52-week low |

**Response:** `{ tickers: [{ symbol, name, aiScore, stage, price, marketCap, sector, catalyst, risks, recommendation, report, appearanceCount, trend, scoreTrajectory: [{ score, stage, date }], return1d, return3d, return7d, return30d, sources, exchange, wk52Lo, wk52Hi, pndFlagged, pndScore, pndFlags, firstSeenDaysAgo, priorAppearances, ... }], total, summary: { totalTrending, risingCount, fallingCount, stableCount, avgScore } }`

---

## GET /api/tickers/network — $0.01 via x402

Network graph of ticker co-occurrences.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| symbol | string | — | Center node symbol (omit for top trending tickers) |
| minWeight | number | 2 | Minimum co-occurrence count for edges |
| stage | string | — | Filter by stage: `EARLY`, `FORMING`, `CONFIRMED` |
| days | number | 30 | Lookback window in days (max 90) |
| maxNodes | number | 30 | Maximum nodes to return (max 50) |

**Response:** `{ nodes: [{ symbol, name, aiScore, stage, price, marketCap, sector, recommendation, appearances }], edges: [{ source, target, weight, correlation }], centerSymbol, effectiveMinWeight }`

---

## GET /api/tickers/:symbol — $0.005 via x402

Latest validated ticker data plus raw signals.

**Response:** `{ ticker: { id, symbol, aiScore, stage, price, marketCap, catalyst, risks, recommendation, report, signalCount, sourceCount, sources, shortFloat, avgSentiment, firstSeenDaysAgo, priorAppearances, return7d, createdAt }, signals: [{ id, symbol, source, title, url, velocityScore, createdAt }] }`

Returns 404 if the symbol has never been validated.

---

## GET /api/tickers/:symbol/related — $0.005 via x402

Co-occurring tickers (tickers that appear in the same scans).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Results per page (max 100) |
| minCoOccurrences | number | 2 | Minimum shared scan appearances |
| days | number | 30 | Lookback window in days (max 90) |
| stage | string | — | Filter by latest stage: `EARLY`, `FORMING`, `CONFIRMED` |

**Response:** `{ relatedTickers: [{ symbol, name, coOccurrenceCount, correlationScore, latestAiScore, latestStage, sector, sources, price, marketCap, recommendation }], targetSymbol, targetScanCount, total }`

---

## GET /api/tickers/:symbol/history — $0.005 via x402

Historical appearances across scans.

**Response:** `{ history: [{ scanId, startedAt, aiScore, stage, price, signalCount, sourceCount, recommendation }] }`

---

## GET /api/tickers/:symbol/performance — $0.005 via x402

Price performance data (1d/3d/7d/30d returns).

**Response:** `{ latest: { symbol, detectionPrice, return1d, return3d, return7d, return30d, price1d, price3d, price7d, price30d, createdAt }, history: [...] }`

Returns improve over time as snapshots accumulate.

---

## POST /api/tickers/:symbol/report — $0.05 via x402

Generate an AI report and trade setup for a ticker. Cached after first generation — subsequent calls for the same ticker return immediately.

**Response:** `{ report: string, tradeSetup: { entryLo, entryHi, stopLoss, target1, target2, timeframe, riskReward, confidence } | null }`

Returns 404 if the ticker has never been validated. Trade setup is only generated for `Buy` or `Strong Buy` recommendations.

---

## GET /api/scans

List monitoring scans (paginated). Requires API key or session.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Results per page (max 100) |
| status | string | — | Filter: `RUNNING`, `COMPLETED`, or `FAILED` |
| from | string | — | Start date (ISO format) |
| to | string | — | End date (ISO format) |

**Response:** `{ scans: [{ id, status, startedAt, completedAt, signalCount, validatedCount, filteredCount }], total, page, limit }`

---

## GET /api/scans/:scanId

Get scan detail with validated tickers. Requires API key or session.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| includeFiltered | boolean | false | Include FILTERED (P&D flagged) tickers |

**Response:** `{ scan: { id, status, startedAt, completedAt, signalCount, validatedCount, filteredCount }, tickers: [{ id, symbol, aiScore, stage, price, marketCap, catalyst, risks, recommendation, report, signalCount, sourceCount, shortFloat, avgSentiment, firstSeenDaysAgo, priorAppearances, return7d, sources, createdAt }] }`

---

## GET /api/signals

Get raw signals for a scan. Requires API key or session.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| scanId | string | required | Scan ID |
| stage | string | — | Filter: `EARLY`, `FORMING`, `CONFIRMED`, `FILTERED` |

**Response:** `{ signals: [{ id, scanId, symbol, source, title, url, velocityScore, createdAt }] }`

Max 200 results, sorted by sourceCount then velocityScore descending.

---

## GET /api/methodology — free

Platform methodology (scoring, stages, P&D detection, signal sources).

**Response:** `{ description, pipelineSteps, signalSources, scoring: { bands }, pumpAndDumpDetection: { flags, threshold }, signalStages, backtesting, disclaimer }`

---

## GET /api/health — free

Health check.

**Response:** `{ status: "ok" | "degraded", timestamp, checks: { database: { status, latencyMs } } }`
