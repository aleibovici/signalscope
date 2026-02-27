import YahooFinance from "yahoo-finance2";
import type { FundamentalData } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function fetchFundamentals(
  symbols: string[]
): Promise<Map<string, FundamentalData>> {
  const result = new Map<string, FundamentalData>();
  if (symbols.length === 0) return result;

  // Batch in groups of 50 to avoid oversized requests
  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50);
    try {
      const quotes = await yf.quote(batch);
      const list = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of list) {
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
          shortFloat: null, // not available via quote endpoint
          fiftyTwoWeekRange,
          name: q.longName ?? q.shortName,
          exchange: q.fullExchangeName ?? q.exchange,
        });
      }
    } catch (err) {
      console.warn(
        `[fundamentals] Batch fetch failed for ${batch.length} symbols:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const withMarketCap = [...result.values()].filter((d) => d.marketCap != null).length;
  console.log(
    `[fundamentals] Fetched ${result.size}/${symbols.length} symbols (${withMarketCap} with marketCap)`
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
