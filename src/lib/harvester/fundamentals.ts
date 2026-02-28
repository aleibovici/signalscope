import YahooFinance from "yahoo-finance2";
import type { FundamentalData } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchShortFloats(symbols: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  // Process in batches of 10 to avoid rate limiting
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const summary = await yf.quoteSummary(sym, { modules: ["defaultKeyStatistics"] });
          const pct = summary.defaultKeyStatistics?.shortPercentOfFloat;
          result.set(sym, pct != null ? Number(pct) : null);
        } catch {
          result.set(sym, null);
        }
      })
    );
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
