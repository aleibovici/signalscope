import YahooFinance from "yahoo-finance2";
import type { FundamentalData } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchQuoteSummaryData(
  symbols: string[]
): Promise<Map<string, { sector?: string; floatShares?: number | null; shortFloat?: number | null }>> {
  const result = new Map<string, { sector?: string; floatShares?: number | null; shortFloat?: number | null }>();
  const CONCURRENCY = 5;
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const summary = await withTimeout(
            yf.quoteSummary(sym, { modules: ["assetProfile", "defaultKeyStatistics"] }),
            YF_TIMEOUT_MS
          );
          result.set(sym, {
            sector: (summary.assetProfile as Record<string, unknown> | null | undefined)?.sector as string | undefined,
            floatShares:
              typeof (summary.defaultKeyStatistics as Record<string, unknown> | null | undefined)?.floatShares === "number"
                ? (summary.defaultKeyStatistics as Record<string, unknown>).floatShares as number
                : null,
            shortFloat:
              typeof (summary.defaultKeyStatistics as Record<string, unknown> | null | undefined)?.shortPercentOfFloat === "number"
                ? (summary.defaultKeyStatistics as Record<string, unknown>).shortPercentOfFloat as number
                : null,
          });
        } catch {
          // non-fatal — sector/floatShares/shortFloat stay null for this symbol
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

  // Fetch quotes (batched) and quoteSummary data (sector/floatShares/shortFloat) in parallel
  const quoteRows: Awaited<ReturnType<typeof yf.quote>>[] = [];
  const [quoteSummaryData] = await Promise.all([
    fetchQuoteSummaryData(symbols),
    (async () => {
      for (let i = 0; i < symbols.length; i += 50) {
        const batch = symbols.slice(i, i + 50);
        try {
          const quotes = await withTimeout(yf.quote(batch), YF_TIMEOUT_MS);
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

    // Extract earnings date if available
    const earningsTs = (q as Record<string, unknown>).earningsTimestamp;
    const earningsDate = typeof earningsTs === "number"
      ? new Date(earningsTs * 1000).toISOString().split("T")[0]
      : undefined;

    // Extract float and shares outstanding
    const floatShares = typeof (q as Record<string, unknown>).floatShares === "number"
      ? (q as Record<string, unknown>).floatShares as number
      : null;
    const sharesOutstanding = typeof (q as Record<string, unknown>).sharesOutstanding === "number"
      ? (q as Record<string, unknown>).sharesOutstanding as number
      : null;

    const extra = quoteSummaryData.get(q.symbol);
    result.set(q.symbol, {
      price: q.regularMarketPrice ?? null,
      marketCap: q.marketCap ?? null,
      shortFloat: extra?.shortFloat ?? null,
      fiftyTwoWeekRange,
      wk52Lo: fiftyTwoLow ?? null,
      wk52Hi: fiftyTwoHigh ?? null,
      name: q.longName ?? q.shortName,
      sector: extra?.sector ?? ((q as Record<string, unknown>).sector as string | undefined),
      exchange: q.fullExchangeName ?? q.exchange,
      earningsDate,
      floatShares: extra?.floatShares ?? floatShares,
      sharesOutstanding,
    });
  }

  const withMarketCap = [...result.values()].filter((d) => d.marketCap != null).length;
  const withShortFloat = [...result.values()].filter((d) => d.shortFloat != null).length;
  console.log(
    `[fundamentals] Fetched ${result.size}/${symbols.length} symbols (${withMarketCap} with marketCap, ${withShortFloat} with shortFloat)`
  );

  return result;
}

const YF_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Yahoo Finance timeout after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.then((v) => { clearTimeout(timerId); return v; }),
    timeoutPromise,
  ]);
}

export async function fetchCurrentPrices(
  symbols: string[]
): Promise<Map<string, number | null>> {
  const priceMap = new Map<string, number | null>();
  if (symbols.length === 0) return priceMap;

  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50);
    try {
      const quotes = await withTimeout(yf.quote(batch), YF_TIMEOUT_MS);
      const list = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of list) {
        if (q.symbol) priceMap.set(q.symbol, q.regularMarketPrice ?? null);
      }
    } catch (err) {
      console.warn(
        `[fundamentals] Batch price fetch failed for ${batch.length} symbols:`,
        err instanceof Error ? err.message : err
      );
      for (const sym of batch) priceMap.set(sym, null);
    }
  }

  return priceMap;
}

export async function fetchCurrentPrice(
  symbol: string
): Promise<number | null> {
  try {
    const q = await withTimeout(yf.quote(symbol), YF_TIMEOUT_MS);
    return q.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}
