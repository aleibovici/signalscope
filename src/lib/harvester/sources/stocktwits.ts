import type { RawSignal } from "../types";
import { BLACKLIST, MEGA_CAPS } from "./ticker-utils";

// StockTwits website is Cloudflare-protected (403). TrendSpider mirrors their
// trending list at a publicly accessible URL and is server-side rendered.
const TRENDSPIDER_URL = "https://trendspider.com/markets/trending-on-stocktwits/";

export async function fetchStockTwitsSignals(): Promise<RawSignal[]> {
  console.log("StockTwits: fetching trending tickers via TrendSpider mirror...");

  try {
    const res = await fetch(TRENDSPIDER_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`StockTwits: TrendSpider returned ${res.status}. Skipping.`);
      return [];
    }

    const html = await res.text();
    const tickers = parseTrendingTickers(html);

    if (tickers.length === 0) {
      console.warn("StockTwits: no tickers parsed from TrendSpider page. Page may be JS-rendered.");
      return [];
    }

    const signals: RawSignal[] = tickers.map(({ symbol, dayGainPct, lastPrice }) => ({
      symbol,
      source: "STOCKTWITS" as const,
      title: `Trending on StockTwits: $${symbol}`,
      body: [
        `$${symbol} is trending on StockTwits.`,
        lastPrice != null ? `Last: $${lastPrice.toFixed(2)}.` : null,
        dayGainPct != null
          ? `Day gain: ${dayGainPct > 0 ? "+" : ""}${dayGainPct.toFixed(2)}%.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      url: `https://stocktwits.com/symbol/${symbol}`,
      postAge: 0,      // currently trending = treat as fresh
      sortType: "rising",
    }));

    console.log(`StockTwits: ${signals.length} trending tickers via TrendSpider`);
    return signals;
  } catch (err) {
    console.warn(
      "StockTwits: failed to fetch TrendSpider data:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

interface TrendingTicker {
  symbol: string;
  lastPrice: number | null;
  dayGainPct: number | null;
}

function parseTrendingTickers(html: string): TrendingTicker[] {
  const results: TrendingTicker[] = [];
  const seen = new Set<string>();

  // TrendSpider uses Alpine.js: each row has x-data="ticker({...})" with HTML-entity-encoded JSON.
  // e.g. x-data="ticker({&quot;symbol&quot;:&quot;AAOI&quot;,&quot;lastPrice&quot;:81.49,&quot;priceChangePercent&quot;:51.78,...})"
  const xdataRegex = /x-data="ticker\((\{[^"]+\})\)"/g;
  let m: RegExpExecArray | null;

  while ((m = xdataRegex.exec(html)) !== null) {
    try {
      // Decode HTML entities (&quot; → ", &amp; → &, etc.)
      const jsonStr = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

      const data = JSON.parse(jsonStr) as {
        symbol?: string;
        lastPrice?: number;
        priceChangePercent?: number;
      };

      const sym = (data.symbol ?? "").toUpperCase();
      if (!sym || !/^[A-Z]{1,5}$/.test(sym)) continue;
      if (BLACKLIST.has(sym) || MEGA_CAPS.has(sym) || seen.has(sym)) continue;

      seen.add(sym);
      results.push({
        symbol: sym,
        lastPrice: typeof data.lastPrice === "number" ? data.lastPrice : null,
        dayGainPct:
          typeof data.priceChangePercent === "number" ? data.priceChangePercent : null,
      });
    } catch {
      // Malformed JSON — skip this entry
    }
  }

  return results;
}
