import type { RawSignal } from "../types";

// S&P 100 + popular ETFs and market movers (~110 liquid tickers)
const SCAN_SYMBOLS = [
  // Mega-cap tech
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "ADBE",
  "CRM", "AMD", "INTC", "CSCO", "QCOM", "TXN", "IBM", "NOW", "INTU", "AMAT",
  // Financials
  "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "USB",
  // Healthcare
  "UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT", "BMY", "AMGN",
  // Consumer
  "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "LOW", "DIS", "NFLX",
  // Energy
  "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX", "VLO", "HAL",
  // Industrials
  "CAT", "BA", "HON", "UPS", "GE", "RTX", "LMT", "DE", "MMM", "UNP",
  // Other large caps
  "V", "MA", "PYPL", "BRK-B", "T", "VZ", "CMCSA", "PEP", "KO", "PM",
  // Popular ETFs
  "SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV", "XLI", "ARKK",
  // Meme / retail favorites
  "GME", "AMC", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "SNAP", "COIN", "HOOD",
];

const VOLUME_SPIKE_THRESHOLD = 2.0;

export async function fetchVolumeSpikeSignals(): Promise<RawSignal[]> {
  console.log("Volume Spike: scanning", SCAN_SYMBOLS.length, "symbols...");
  const signals: RawSignal[] = [];

  // Process in parallel batches of 10 (same pattern as fundamentals.ts)
  for (let i = 0; i < SCAN_SYMBOLS.length; i += 10) {
    const batch = SCAN_SYMBOLS.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((symbol) => fetchVolumeData(symbol))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const { symbol, regularMarketVolume, averageDailyVolume10Day } = result.value;

        if (averageDailyVolume10Day > 0) {
          const ratio = regularMarketVolume / averageDailyVolume10Day;

          if (ratio >= VOLUME_SPIKE_THRESHOLD) {
            signals.push({
              symbol,
              source: "VOLUME_SPIKE",
              title: `Volume spike: ${symbol} trading at ${ratio.toFixed(1)}x average volume`,
              body: `Current volume: ${formatVolume(regularMarketVolume)}, 10-day avg: ${formatVolume(averageDailyVolume10Day)}, ratio: ${ratio.toFixed(2)}x`,
              volumeRatio: Math.round(ratio * 100) / 100,
            });
          }
        }
      }
    }
  }

  console.log(`Volume Spike: ${signals.length} signals`);
  return signals;
}

interface VolumeData {
  symbol: string;
  regularMarketVolume: number;
  averageDailyVolume10Day: number;
}

async function fetchVolumeData(symbol: string): Promise<VolumeData | null> {
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
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const regularMarketVolume = meta.regularMarketVolume ?? 0;
    const averageDailyVolume10Day = meta.averageDailyVolume10Day ?? 0;

    return { symbol, regularMarketVolume, averageDailyVolume10Day };
  } catch {
    return null;
  }
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
