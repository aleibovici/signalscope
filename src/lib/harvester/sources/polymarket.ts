import type { RawSignal } from "../types";
import { SCAN_SYMBOLS } from "./ticker-utils";

const POLYMARKET_API = "https://gamma-api.polymarket.com";
// Thresholds applied at the EVENT level (sum across all markets in an event)
const MIN_EVENT_VOLUME = 5_000;      // $5K total event volume
const MIN_EVENT_VOLUME_24H = 1_000;  // $1K 24h volume across event markets
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1_000;

// Price prediction keywords
const PRICE_KEYWORDS = ["close", "above", "below", "price", "open", "high", "low", "end of", "hit"];

// Catalyst event keywords — events that precede breakouts
const CATALYST_KEYWORDS = [
  "earnings", "revenue", "beat", "miss", "guidance",
  "merger", "acquisition", "acquire", "takeover", "buyout",
  "fda", "approval", "approve",
  "s&p 500", "s&p500", "index", "added to",
  "ipo", "spinoff", "spin off", "split",
  "deliveries", "sales", "profit",
  "launch", "release",
  "bankruptcy", "delisting", "delist",
];

interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  active: boolean;
  closed: boolean;
  volume?: string;
  volume24hr?: string;
  liquidity?: string;
  outcomePrices: string | string[];
  outcomes: string | string[];
  endDate: string;
}

interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  markets: PolymarketMarket[];
}

interface SearchResponse {
  events: PolymarketEvent[];
}

/**
 * Fetch Polymarket signals for the given symbols (defaults to SCAN_SYMBOLS).
 * Called twice during harvest: once with SCAN_SYMBOLS in parallel with other sources,
 * then again with any extra symbols discovered by other sources.
 */
export async function fetchPolymarketSignals(symbols?: string[]): Promise<RawSignal[]> {
  const list = symbols ?? SCAN_SYMBOLS;
  console.log(`Polymarket: scanning ${list.length} symbols...`);
  const signals: RawSignal[] = [];

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((symbol) => searchSymbol(symbol))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        signals.push(...result.value);
      }
    }

    if (i + BATCH_SIZE < list.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`Polymarket: ${signals.length} signals`);
  return signals;
}

async function searchSymbol(symbol: string): Promise<RawSignal[]> {
  try {
    const url = `${POLYMARKET_API}/public-search?q=${encodeURIComponent(symbol)}&limit_per_type=10`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SignalScope/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];

    const data: SearchResponse = await res.json();
    const signals: RawSignal[] = [];

    for (const event of data.events ?? []) {
      // Aggregate volume across all active, relevant markets in this event
      const activeMarkets: PolymarketMarket[] = [];
      let eventVolume = 0;
      let eventVolume24h = 0;
      let eventLiquidity = 0;

      for (const market of event.markets ?? []) {
        if (!market.active || market.closed) continue;
        if (!isRelevantMarket(market.question, symbol)) continue;

        activeMarkets.push(market);
        eventVolume += Number(market.volume) || 0;
        eventVolume24h += Number(market.volume24hr) || 0;
        eventLiquidity += Number(market.liquidity) || 0;
      }

      if (activeMarkets.length === 0) continue;

      // Event-level volume gate
      const hasActivity =
        eventVolume >= MIN_EVENT_VOLUME || eventVolume24h >= MIN_EVENT_VOLUME_24H;
      if (!hasActivity) continue;

      // Pick the highest-probability market as representative
      let bestProb = 0;
      let bestMarket = activeMarkets[0];
      for (const m of activeMarkets) {
        const prob = parseOutcomeProbability(m.outcomePrices, m.outcomes);
        if (prob > bestProb) {
          bestProb = prob;
          bestMarket = m;
        }
      }

      const endDate = bestMarket.endDate || activeMarkets[0].endDate;

      signals.push({
        symbol,
        source: "POLYMARKET",
        title: `Prediction market: ${event.title}`,
        body: `${activeMarkets.length} active markets, Vol 24h: ${fmtUsd(eventVolume24h)}, Total vol: ${fmtUsd(eventVolume)}, Liquidity: ${fmtUsd(eventLiquidity)}, Top prob: ${(bestProb * 100).toFixed(1)}%`,
        url: `https://polymarket.com/event/${event.slug}`,
        marketProbability: Math.round(bestProb * 1000) / 1000,
        marketVolume24hr: Math.round(eventVolume24h * 100) / 100,
        marketLiquidity: Math.round(eventLiquidity * 100) / 100,
        marketEndDate: endDate || undefined,
      });
    }

    return signals;
  } catch {
    return [];
  }
}

/**
 * Check if a Polymarket question is relevant to the given stock ticker.
 * Must contain the ticker symbol AND either a price keyword or a catalyst keyword.
 */
function isRelevantMarket(question: string, symbol: string): boolean {
  // Short tickers (1-2 chars like "C", "V", "MA") require parenthesized form to avoid false matches.
  const hasSymbol =
    question.includes(`(${symbol})`) ||
    (symbol.length >= 3 && new RegExp(`\\b${symbol}\\b`).test(question));
  if (!hasSymbol) return false;

  const q = question.toLowerCase();
  return (
    q.includes("$") ||
    PRICE_KEYWORDS.some((kw) => q.includes(kw)) ||
    CATALYST_KEYWORDS.some((kw) => q.includes(kw))
  );
}

function parseOutcomeProbability(rawPrices: string | string[], rawOutcomes: string | string[]): number {
  // API returns outcomePrices/outcomes as JSON-encoded strings, not arrays
  const prices: string[] = typeof rawPrices === "string" ? tryParseJsonArray(rawPrices) : rawPrices;
  const outcomes: string[] = typeof rawOutcomes === "string" ? tryParseJsonArray(rawOutcomes) : rawOutcomes;

  if (!prices?.length) return 0;

  // Binary Yes/No: return the "Yes" probability
  const yesIdx = outcomes?.findIndex((o) => o.toLowerCase() === "yes") ?? -1;
  if (yesIdx >= 0 && yesIdx < prices.length) {
    return parseFloat(prices[yesIdx]) || 0;
  }

  // Bracket markets (price ranges): return the highest probability bracket
  return Math.max(...prices.map((p) => parseFloat(p) || 0));
}

function tryParseJsonArray(s: string): string[] {
  try { const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}
