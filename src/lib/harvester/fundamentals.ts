import type { FundamentalData } from "./types";

export async function fetchFundamentals(
  symbols: string[]
): Promise<Map<string, FundamentalData>> {
  const result = new Map<string, FundamentalData>();

  // Use Yahoo v8 chart API (works without auth, unlike v7 batch which requires crumb)
  // Process in parallel batches of 10 to avoid rate limiting
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const entries = await Promise.allSettled(
      batch.map((symbol) => fetchV8Chart(symbol))
    );

    for (const entry of entries) {
      if (entry.status === "fulfilled" && entry.value) {
        result.set(entry.value[0], entry.value[1]);
      }
    }
  }

  return result;
}

async function fetchV8Chart(
  symbol: string
): Promise<[string, FundamentalData] | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const fiftyTwoLow = meta.fiftyTwoWeekLow;
    const fiftyTwoHigh = meta.fiftyTwoWeekHigh;
    const fiftyTwoWeekRange =
      fiftyTwoLow != null && fiftyTwoHigh != null
        ? `${fiftyTwoLow.toFixed(2)} - ${fiftyTwoHigh.toFixed(2)}`
        : undefined;

    return [
      symbol,
      {
        price: meta.regularMarketPrice ?? null,
        marketCap: null,
        shortFloat: null,
        fiftyTwoWeekRange,
        name: meta.longName ?? meta.shortName,
        exchange: meta.fullExchangeName ?? meta.exchangeName,
      },
    ];
  } catch {
    return null;
  }
}

export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}
