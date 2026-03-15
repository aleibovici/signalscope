---
name: signalscope-api
description: >
  Interact with the SignalScope stock breakout signal detection API at signalscopes.com.
  Query scans, signals, trending tickers, performance data, and manage portfolios and
  watchlists. Use when the user asks about stock signals, breakout candidates, or wants
  to check or manage their SignalScope data.
---

# SignalScope API Skill

## Overview

SignalScope is a stock breakout signal detection platform. It harvests signals from Reddit, X/Twitter, StockTwits, SEC insider filings, options flow, and volume spikes, then scores them with AI, filters pump-and-dump candidates, and presents validated tickers ranked by confidence.

**Base URL:** `https://signalscopes.com`

## Authentication

All endpoints require an API key:

1. Log in at signalscopes.com and go to your Profile page
2. Click "Generate API Key" and copy the key (shown only once)
3. Include it in all requests as an `x-api-key` header

```
x-api-key: sk_sig_your_key_here
```

## Key Concepts

- **Scan**: A harvest run that collects signals from all sources, scores them, and produces validated tickers
- **Signal stages**: `EARLY` (1 source), `FORMING` (2 sources), `CONFIRMED` (3+ sources), `FILTERED` (P&D flagged)
- **AI Score**: 0-100 confidence score. 70+ is strong, 50-70 moderate, below 50 weak
- **Trending**: Tickers appearing in 2+ scans within 30 days, with trend direction (rising/falling/stable)
- **Pagination**: Most list endpoints accept `page` (default 1) and `limit` (default 20, max 100)
- **Symbols**: Always uppercase (e.g., `AAPL`, `TSLA`)

## API Reference

- [Signal & scan endpoints](api-public.md) — 11 endpoints for scans, signals, tickers, trending, methodology
- [Account endpoints](api-authenticated.md) — 16 endpoints for portfolio, watchlist, performance, profile, API key management

## Common Workflows

### Check latest scan results

```bash
# Get recent scans
curl -H "x-api-key: $KEY" https://signalscopes.com/api/scans?limit=5

# Get tickers from a specific scan
curl -H "x-api-key: $KEY" https://signalscopes.com/api/scans/SCAN_ID

# Include filtered (P&D flagged) tickers
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/scans/SCAN_ID?includeFiltered=true"
```

### Find trending tickers

```bash
# Tickers appearing in 2+ scans (default)
curl -H "x-api-key: $KEY" https://signalscopes.com/api/tickers/trending

# Only rising tickers with 3+ appearances
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/tickers/trending?minAppearances=3&trend=rising"

# Filter by stage
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/tickers/trending?stage=CONFIRMED"

# Advanced: micro-cap tickers sorted by return, hiding P&D flagged
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/tickers/trending?marketCap=micro&sortBy=return&hidePnd=true"

# Tickers near 52-week low from Reddit
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/tickers/trending?near52wLow=true&source=REDDIT"
```

### Deep-dive a specific ticker

```bash
# Latest data + raw signals
curl -H "x-api-key: $KEY" https://signalscopes.com/api/tickers/AAPL

# Historical appearances across scans
curl -H "x-api-key: $KEY" https://signalscopes.com/api/tickers/AAPL/history

# Price performance (1d/3d/7d/30d returns)
curl -H "x-api-key: $KEY" https://signalscopes.com/api/tickers/AAPL/performance

# Co-occurring tickers (appear in same scans)
curl -H "x-api-key: $KEY" https://signalscopes.com/api/tickers/AAPL/related
```

### Manage portfolio

```bash
# List positions
curl -H "x-api-key: $KEY" https://signalscopes.com/api/portfolio

# Add a position
curl -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","entryPrice":185.50,"shares":10}' \
  https://signalscopes.com/api/portfolio

# Close a position
curl -X PATCH -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"status":"CLOSED","closePrice":192.00}' \
  https://signalscopes.com/api/portfolio/POSITION_ID

# Delete a position
curl -X DELETE -H "x-api-key: $KEY" https://signalscopes.com/api/portfolio/POSITION_ID
```

### Manage watchlist

```bash
# List watchlist
curl -H "x-api-key: $KEY" https://signalscopes.com/api/watchlist

# Add to watchlist
curl -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA"}' \
  https://signalscopes.com/api/watchlist

# Remove from watchlist
curl -X DELETE -H "x-api-key: $KEY" https://signalscopes.com/api/watchlist/TSLA
```

### Manage API key

```bash
# Check if you have an active key
curl -H "x-api-key: $KEY" https://signalscopes.com/api/user/api-key

# Generate a new key (revokes existing)
curl -X POST -H "x-api-key: $KEY" https://signalscopes.com/api/user/api-key

# Revoke your key
curl -X DELETE -H "x-api-key: $KEY" https://signalscopes.com/api/user/api-key
```

### Check platform performance

```bash
# 7-day performance breakdown by stage, type, and score range
curl -H "x-api-key: $KEY" https://signalscopes.com/api/performance?days=7

# Platform stats
curl -H "x-api-key: $KEY" https://signalscopes.com/api/stats

# Current prices for specific symbols
curl -H "x-api-key: $KEY" "https://signalscopes.com/api/prices?symbols=AAPL,TSLA,NVDA"
```

## Error Handling

All errors return JSON with an `error` field:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation failed (check `details` for specific issues) |
| 401 | Not authenticated — missing or invalid API key |
| 404 | Resource not found |
| 500 | Server error |

Example error response:
```json
{ "error": "Validation failed", "details": [{ "path": ["symbol"], "message": "Required" }] }
```

## Tips

- Symbol lookup is case-insensitive: `/api/tickers/aapl` works the same as `/api/tickers/AAPL`
- Use `includeFiltered=true` on scan detail to see pump-and-dump flagged tickers
- The `search` endpoint (`GET /api/search?q=APP`) finds tickers by partial symbol or name match
- Performance data improves over time as more price snapshots accumulate
- Trending tickers with `trend=rising` and high AI scores are the strongest signals
