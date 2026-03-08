import type { RawSignal } from "../types";
import { BLACKLIST } from "./ticker-utils";

const CAPITOL_TRADES_URL = "https://www.capitoltrades.com/trades";

// Minimum trade value to generate a signal (Congress reports ranges, we use the lower bound)
const MIN_TRADE_VALUE = 1_000;
// Only include trades filed within the last 7 days
const MAX_PUB_AGE_DAYS = 7;

interface CapitolTrade {
  txId: number;          // Capitol Trades unique transaction ID
  issuerTicker: string;  // e.g. "UBER:US"
  issuerName: string;
  sector: string | null;
  txType: "buy" | "sell";
  txDate: string;        // e.g. "2026-02-06"
  pubDate: string;       // ISO datetime
  value: number;
  reportingGap: number;  // days between trade and disclosure
  chamber: "senate" | "house";
  firstName: string;
  lastName: string;
  party: string;
}

function extractTradesFromRsc(html: string): CapitolTrade[] {
  const trades: CapitolTrade[] = [];

  // Capitol Trades embeds trade data as JSON in Next.js RSC script chunks.
  // The data is escaped inside self.__next_f.push([1, "..."]) calls.
  const scriptRegex = /self\.__next_f\.push\(\[1,"([^]*?)"\]\)/g;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1];
    if (!raw.includes("_txId")) continue;

    // Unescape the RSC JSON string (escaped quotes)
    const unescaped = raw.replace(/\\"/g, '"');

    // Find the "data" array within the unescaped content
    const dataMatch = unescaped.match(/"data":\[(\{[^]*)\],"columnVisibility"/);
    if (!dataMatch) continue;

    try {
      const dataArray = JSON.parse(`[${dataMatch[1]}]`);
      for (const item of dataArray) {
        if (!item.issuer?.issuerTicker || !item.txType || !item._txId) continue;

        trades.push({
          txId: item._txId,
          issuerTicker: item.issuer.issuerTicker,
          issuerName: item.issuer.issuerName || "",
          sector: item.issuer.sector || null,
          txType: item.txType,
          txDate: item.txDate || "",
          pubDate: item.pubDate || "",
          value: item.value || 0,
          reportingGap: item.reportingGap || 0,
          chamber: item.chamber || "house",
          firstName: item.politician?.firstName || "",
          lastName: item.politician?.lastName || "",
          party: item.politician?.party || "",
        });
      }
    } catch {
      continue;
    }
  }

  return trades;
}

function extractTicker(issuerTicker: string): string | null {
  // Format is "UBER:US" — extract the symbol part
  const symbol = issuerTicker.split(":")[0];
  if (!symbol || symbol.length > 5 || symbol.length < 1) return null;
  if (BLACKLIST.has(symbol)) return null;
  // Skip non-US tickers
  if (issuerTicker.includes(":") && !issuerTicker.endsWith(":US")) return null;
  return symbol;
}

export async function fetchCongressSignals(): Promise<RawSignal[]> {
  console.log("Congress: fetching recent trades from Capitol Trades...");

  try {
    const res = await fetch(CAPITOL_TRADES_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`Congress: Capitol Trades returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const allTrades = extractTradesFromRsc(html);

    if (allTrades.length === 0) {
      console.warn("Congress: no trades extracted from Capitol Trades HTML");
      return [];
    }

    // Filter: only buys, recent publications, minimum value, valid US tickers
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_PUB_AGE_DAYS);

    const signals: RawSignal[] = [];

    for (const trade of allTrades) {
      if (trade.txType !== "buy") continue;
      if (trade.value < MIN_TRADE_VALUE) continue;

      const pubDate = new Date(trade.pubDate);
      if (pubDate < cutoff) continue;

      const symbol = extractTicker(trade.issuerTicker);
      if (!symbol) continue;

      const politician = `${trade.firstName} ${trade.lastName}`;
      const chamber = trade.chamber === "senate" ? "Sen." : "Rep.";
      const party = trade.party ? ` (${trade.party.charAt(0).toUpperCase()})` : "";

      signals.push({
        symbol,
        source: "CONGRESS",
        title: `Congress buy: ${chamber} ${politician}${party} purchased ${symbol}`,
        body: `${chamber} ${politician} bought ~$${trade.value.toLocaleString()} of ${trade.issuerName} (${symbol}). Trade date: ${trade.txDate}, disclosed: ${trade.pubDate.slice(0, 10)}. Reporting gap: ${trade.reportingGap} days.${trade.sector ? ` Sector: ${trade.sector}.` : ""}`,
        url: `https://www.capitoltrades.com/trades?ticker=${symbol}&txId=${trade.txId}`,
        author: `${chamber} ${politician}`,
        purchaseValue: trade.value,
      });
    }

    // Each signal has a unique txId in the URL — no within-fetch duplicates possible.
    // Multiple trades by the same politician for the same ticker are kept as separate signals
    // (they represent distinct transactions with different dates/values).
    const result = signals;
    console.log(`Congress: ${allTrades.length} trades found, ${result.length} buy signals (${allTrades.filter(t => t.txType === "buy").length} buys total, filtered by value/date/ticker)`);
    return result;
  } catch (err) {
    console.warn("Congress error:", err instanceof Error ? err.message : err);
    return [];
  }
}
