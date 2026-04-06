---
name: signalscope-api
description: >
  Interact with the SignalScope stock breakout signal detection API at localhost:3000.
  Query scans, signals, trending tickers, performance data, and manage portfolios and
  watchlists. Use when the user asks about stock signals, breakout candidates, or wants
  to check or manage their SignalScope data.
---

# SignalScope API Skill

## Overview

SignalScope is a stock breakout signal detection platform. It monitors Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow (including net premium tracking), and volume spikes for signals, then scores them with AI, filters pump-and-dump candidates, and presents validated tickers with two scores: **Opportunity** (early-mover potential; used to sort the main signal list) and **signal confidence / AI score** (how strong the evidence is). High AI confidence does not always mean higher forward returns — it can indicate broad agreement and a move that is already priced in.

**Base URL:** `http://localhost:3000`

## Authentication

SignalScope supports two access methods:

### Option 1 — x402 micropayments (recommended for agents, no registration required)

Pay-per-call in USDC on Base (L2). No account or API key needed. Each request to a monetized endpoint returns HTTP 402 with payment details if unpaid. Use an x402-compatible client to handle payments automatically.

**How it works:**
1. Send request to endpoint → receive `402 Payment Required` with `payment-required` header
2. Decode the base64 `payment-required` header to get payment details (amount, asset, payTo address)
3. Sign a USDC `transferWithAuthorization` (EIP-3009) on Base mainnet
4. Retry the same request with the `X-PAYMENT` header containing the payment proof
5. Receive data — payment settles on-chain only if the response is successful

**Payment details:**
- Network: Base mainnet (`eip155:8453`)
- Asset: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Scheme: `exact` (EIP-3009 `transferWithAuthorization`)

**Prices per endpoint:**

| Endpoint | Price |
|----------|-------|
| `GET /api/tickers/trending` | $0.01 |
| `GET /api/tickers/network` | $0.01 |
| `GET /api/tickers/:symbol` | $0.005 |
| `GET /api/tickers/:symbol/related` | $0.005 |
| `GET /api/tickers/:symbol/history` | $0.005 |
| `GET /api/tickers/:symbol/performance` | $0.005 |
| `POST /api/tickers/:symbol/report` | $0.05 |

**Free (no auth, no payment):**
- `GET /api/search` — symbol discovery endpoint
- `GET /api/health` — health check

**Also free (no auth, no payment):**
- `GET /api/methodology` — methodology, scoring, P&D detection, and `scoreComparison` (rate-limited: 30 req/min)
- `GET /api/scans` / `GET /api/scans/:scanId` — scan list and scan detail
- `GET /api/signals` — raw signals for a scan

```bash
# Example: x402 flow (most x402 clients handle this automatically)

# Step 1 — Initial request returns 402
curl -I http://localhost:3000/api/tickers/trending
# → HTTP/1.1 402 Payment Required
# → payment-required: eyJ4NDAyVmVyc2lvbi... (base64 JSON with payment details)

# Step 2 — Decode payment details
echo "eyJ4NDAyVmVyc2lvbi..." | base64 -d
# → { "accepts": [{ "scheme": "exact", "network": "eip155:8453",
#      "amount": "10000", "asset": "0x833589f...", "payTo": "0x948B..." }] }

# Step 3 — Retry with payment proof (handled by x402 client library)
curl -H "X-PAYMENT: <payment-proof>" http://localhost:3000/api/tickers/trending
```

### Option 2 — API key (for registered users)

1. Log in at localhost:3000 and go to your Profile page
2. Click "Generate API Key" and copy the key (shown only once)
3. Include it in all requests as an `x-api-key` header

```
x-api-key: sk_sig_your_key_here
```

API keys provide access to all endpoints including account management (portfolio, watchlist, profile). Exception: `POST /api/tickers/:symbol/report` is not available via API key — use x402 or a browser session.

## Key Concepts

- **Scan**: A monitoring run that collects signals from all sources, scores them, and produces validated tickers
- **Signal stages**: `Emerging` (score ≥40, earliest detection), `Building` (score ≥45–50 with velocity or multi-source), `Consensus` (score ≥65+ with broad corroboration), `Filtered` (P&D flagged)
- **Opportunity score** (0–100): Early-mover / setup quality — higher means the model favors timing alpha (dashboard sorts by this)
- **AI score / signal confidence** (0–100): Strength of evidence (sources, sentiment, corroboration). 70+ is strong, 50–70 moderate, below 50 weak — not the same as expected upside; very high scores often overlap with consensus
- **Trending**: Tickers appearing in 2+ scans within 30 days, with trend direction (rising/falling/stable)
- **Pagination**: Most list endpoints accept `page` (default 1) and `limit` (default 20, max 100)
- **Symbols**: Always uppercase (e.g., `AAPL`, `TSLA`)

**Full field-by-field definitions:** [api-public.md — Opportunity score vs signal confidence](api-public.md#opportunity-score-vs-signal-confidence-ai). **Machine-readable copy** (for agents): `GET /api/methodology` → `scoreComparison`.

## API Reference

- [Signal & scan endpoints](api-public.md) — scans, signals, tickers, trending, network, methodology (most public or x402)
- [Account endpoints](api-authenticated.md) — portfolio, watchlist, performance, profile, API key management (require API key or session, not x402)

## Common Workflows

### Discover tickers without an account (x402)

```bash
# Free: search for a ticker by symbol
curl http://localhost:3000/api/search?q=AAPL

# Paid ($0.005): get full ticker data with signals
# (use an x402 client for automatic payment handling)
curl -H "X-PAYMENT: <proof>" http://localhost:3000/api/tickers/AAPL

# Paid ($0.01): browse trending breakout signals
curl -H "X-PAYMENT: <proof>" http://localhost:3000/api/tickers/trending

# Paid ($0.01): explore co-occurrence network
curl -H "X-PAYMENT: <proof>" http://localhost:3000/api/tickers/network
```

### Check latest scan results (public — no auth needed)

```bash
# Get recent scans
curl http://localhost:3000/api/scans?limit=5

# Get tickers from a specific scan
curl http://localhost:3000/api/scans/SCAN_ID

# Include filtered (P&D flagged) tickers
curl "http://localhost:3000/api/scans/SCAN_ID?includeFiltered=true"
```

### Find trending tickers

```bash
# Tickers appearing in 2+ scans (default)
curl -H "x-api-key: $KEY" http://localhost:3000/api/tickers/trending

# Only rising tickers with 3+ appearances
curl -H "x-api-key: $KEY" "http://localhost:3000/api/tickers/trending?minAppearances=3&trend=rising"

# Filter by stage
curl -H "x-api-key: $KEY" "http://localhost:3000/api/tickers/trending?stage=Consensus"

# Advanced: micro-cap tickers sorted by return, hiding P&D flagged
curl -H "x-api-key: $KEY" "http://localhost:3000/api/tickers/trending?marketCap=micro&sortBy=return&hidePnd=true"

# Tickers near 52-week low from Reddit
curl -H "x-api-key: $KEY" "http://localhost:3000/api/tickers/trending?near52wLow=true&source=REDDIT"
```

### Deep-dive a specific ticker

```bash
# Latest data + raw signals
curl -H "x-api-key: $KEY" http://localhost:3000/api/tickers/AAPL

# Historical appearances across scans
curl -H "x-api-key: $KEY" http://localhost:3000/api/tickers/AAPL/history

# Price performance (1d/3d/7d/30d returns)
curl -H "x-api-key: $KEY" http://localhost:3000/api/tickers/AAPL/performance

# Price-correlated tickers (sorted by absolute price correlation)
curl -H "x-api-key: $KEY" http://localhost:3000/api/tickers/AAPL/related

# Generate AI report + trade setup ($0.05 via x402; NOT available via API key)
# Use x402 payment or a browser session for this endpoint
```

### Manage portfolio

```bash
# List positions
curl -H "x-api-key: $KEY" http://localhost:3000/api/portfolio

# Add a position
curl -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","entryPrice":185.50,"shares":10}' \
  http://localhost:3000/api/portfolio

# Close a position
curl -X PATCH -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"status":"CLOSED","closePrice":192.00}' \
  http://localhost:3000/api/portfolio/POSITION_ID

# Delete a position
curl -X DELETE -H "x-api-key: $KEY" http://localhost:3000/api/portfolio/POSITION_ID
```

### Manage watchlist

```bash
# List watchlist
curl -H "x-api-key: $KEY" http://localhost:3000/api/watchlist

# Add to watchlist
curl -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA"}' \
  http://localhost:3000/api/watchlist

# Remove from watchlist
curl -X DELETE -H "x-api-key: $KEY" http://localhost:3000/api/watchlist/TSLA
```

### Manage API key

```bash
# Check if you have an active key
curl -H "x-api-key: $KEY" http://localhost:3000/api/user/api-key

# Generate a new key (revokes existing)
curl -X POST -H "x-api-key: $KEY" http://localhost:3000/api/user/api-key

# Revoke your key
curl -X DELETE -H "x-api-key: $KEY" http://localhost:3000/api/user/api-key
```

### Check platform performance

```bash
# 7-day performance breakdown by stage, type, and score range
curl -H "x-api-key: $KEY" http://localhost:3000/api/performance?days=7

# Platform stats
curl -H "x-api-key: $KEY" http://localhost:3000/api/stats

# Current prices for specific symbols
curl -H "x-api-key: $KEY" "http://localhost:3000/api/prices?symbols=AAPL,TSLA,NVDA"
```

## Error Handling

All errors return JSON with an `error` field:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation failed (check `details` for specific issues) |
| 401 | Not authenticated — missing or invalid API key |
| 402 | Payment required — no valid payment found; decode `payment-required` header for details |
| 404 | Resource not found |
| 500 | Server error |

Example 402 response header (base64-decoded):
```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": { "url": "http://localhost:3000/api/tickers/trending", "description": "..." },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "10000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x948BfF906cbBbB85EF20EA48BE5d54a783699F9e",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

Example 401 error response:
```json
{ "error": "Not authenticated" }
```

## Tips

- Symbol lookup is case-insensitive: `/api/tickers/aapl` works the same as `/api/tickers/AAPL`
- Use `GET /api/search?q=APP` for free symbol discovery — no auth or payment required
- Use `includeFiltered=true` on scan detail to see pump-and-dump flagged tickers
- Performance data improves over time as more price snapshots accumulate
- Rising trend plus high **Opportunity** is a better default screen than AI score alone — confidence measures evidence, not remaining upside
- x402 payments are atomic — you are only charged if the server returns a successful response
- For high-volume agent use cases, x402 micropayments are more cost-efficient than a subscription
