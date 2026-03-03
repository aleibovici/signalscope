import YahooFinance from "yahoo-finance2";
import type { FundamentalData } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const FINVIZ_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchShortFloatFinviz(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, {
      headers: {
        "User-Agent": FINVIZ_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finviz.com/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[finviz] ${symbol}: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Use indexOf so the label is found regardless of surrounding tags (<b>, etc.)
    const idx = html.indexOf("Short Float");
    if (idx === -1) {
      console.warn(`[finviz] ${symbol}: label not found`);
      return null;
    }

    // The value cell contains the percentage inside nested tags e.g. <a><b>0.91%</b></a>
    // Scan the next 400 chars for the first ">NUMBER%<" pattern
    const after = html.slice(idx, idx + 400);
    const pctMatch = after.match(/>([0-9]+\.?[0-9]*)%</);
    if (!pctMatch) return null;

    const val = parseFloat(pctMatch[1]);
    return isFinite(val) ? val / 100 : null;
  } catch (err) {
    console.warn(`[finviz] ${symbol}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function fetchShortFloats(symbols: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  // Batch 3 concurrent requests with 500ms between batches to respect Finviz rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const values = await Promise.all(batch.map((sym) => fetchShortFloatFinviz(sym)));
    for (let j = 0; j < batch.length; j++) {
      result.set(batch[j], values[j]);
    }
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Canary check: warn if Finviz scraping may be broken
  if (symbols.length >= 4) {
    const nullCount = [...result.values()].filter((v) => v === null).length;
    if (nullCount > symbols.length * 0.5) {
      console.error(
        `[finviz] WARNING: ${nullCount}/${symbols.length} symbols returned null for short float — Finviz scraping may be broken`
      );
    }
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

    result.set(q.symbol, {
      price: q.regularMarketPrice ?? null,
      marketCap: q.marketCap ?? null,
      shortFloat: shortFloats.get(q.symbol) ?? null,
      fiftyTwoWeekRange,
      name: q.longName ?? q.shortName,
      sector: (q as Record<string, unknown>).sector as string | undefined,
      exchange: q.fullExchangeName ?? q.exchange,
      earningsDate,
      floatShares,
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
