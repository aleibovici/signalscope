import YahooFinance from "yahoo-finance2";
import type { FundamentalData } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const FINVIZ_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchShortFloatFinviz(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://finviz.com/quote.ashx?t=${symbol}&ty=c&p=d&b=1`, {
      headers: {
        "User-Agent": FINVIZ_UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finviz.com/",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    // Find "Short Float" label, then grab the next table-cell value
    const match = html.match(/Short Float[^<]*<\/td>\s*<td[^>]*>([^<]+)</);
    if (!match) return null;

    const raw = match[1].trim().replace("%", "");
    const val = parseFloat(raw);
    return isFinite(val) ? val / 100 : null;
  } catch {
    return null;
  }
}

async function fetchShortFloats(symbols: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  // Sequential with 300 ms gap to avoid rate-limiting Finviz
  for (const sym of symbols) {
    result.set(sym, await fetchShortFloatFinviz(sym));
    await new Promise((r) => setTimeout(r, 300));
  }
  return result;
}

export async function fetchFundamentals(
  symbols: string[]
): Promise<Map<string, FundamentalData>> {
  const result = new Map<string, FundamentalData>();
  if (symbols.length === 0) return result;

  // Fetch quotes (batched) and short floats (per-symbol) in parallel
  const quoteRows: Awaited<ReturnType<typeof yf.quote>>[] = [];
  const [shortFloats] = await Promise.all([
    fetchShortFloats(symbols),
    (async () => {
      for (let i = 0; i < symbols.length; i += 50) {
        const batch = symbols.slice(i, i + 50);
        try {
          const quotes = await yf.quote(batch);
          const list = Array.isArray(quotes) ? quotes : [quotes];
          quoteRows.push(...list);
        } catch (err) {
          console.warn(
            `[fundamentals] Batch fetch failed for ${batch.length} symbols:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })(),
  ]);

  for (const q of quoteRows) {
    if (!q.symbol) continue;

    const fiftyTwoLow = q.fiftyTwoWeekLow;
    const fiftyTwoHigh = q.fiftyTwoWeekHigh;
    const fiftyTwoWeekRange =
      fiftyTwoLow != null && fiftyTwoHigh != null
        ? `${Number(fiftyTwoLow).toFixed(2)} - ${Number(fiftyTwoHigh).toFixed(2)}`
        : undefined;

    result.set(q.symbol, {
      price: q.regularMarketPrice ?? null,
      marketCap: q.marketCap ?? null,
      shortFloat: shortFloats.get(q.symbol) ?? null,
      fiftyTwoWeekRange,
      name: q.longName ?? q.shortName,
      exchange: q.fullExchangeName ?? q.exchange,
    });
  }

  const withMarketCap = [...result.values()].filter((d) => d.marketCap != null).length;
  const withShortFloat = [...result.values()].filter((d) => d.shortFloat != null).length;
  console.log(
    `[fundamentals] Fetched ${result.size}/${symbols.length} symbols (${withMarketCap} with marketCap, ${withShortFloat} with shortFloat)`
  );

  return result;
}

export async function fetchCurrentPrice(
  symbol: string
): Promise<number | null> {
  try {
    const q = await yf.quote(symbol);
    return q.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}
