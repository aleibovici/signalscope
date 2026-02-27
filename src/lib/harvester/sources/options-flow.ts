import YahooFinance from "yahoo-finance2";
import type { RawSignal } from "../types";
import { SCAN_SYMBOLS } from "./ticker-utils";

// yahoo-finance2 doesn't export subpath types, so define what we need
interface OptionsContract {
  contractSymbol: string;
  strike: number;
  volume?: number;
  openInterest?: number;
  expiration: Date;
  impliedVolatility: number;
  inTheMoney: boolean;
  [key: string]: unknown;
}

interface OptionsChainResult {
  quote: { regularMarketPrice?: number; [key: string]: unknown };
  options: { calls: OptionsContract[]; puts: OptionsContract[] }[];
  [key: string]: unknown;
}

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Thresholds
const VOL_OI_RATIO_THRESHOLD = 3.0;
const MIN_ABSOLUTE_VOLUME = 1_000;
const MIN_OPEN_INTEREST = 100;
const OTM_FACTOR = 1.10; // 10%+ above current price
const SWEEP_MIN_STRIKES = 3;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2_000;

interface UnusualContract {
  strike: number;
  expiry: string;
  type: "Call" | "Put";
  volume: number;
  openInterest: number;
  volOiRatio: number;
  isOTM: boolean;
}

/**
 * Returns the next Friday (standard weekly expiry) as a Unix timestamp.
 * If today is Friday, returns today. This limits the Yahoo options response
 * to a single expiry date, avoiding the headers overflow issue.
 */
function getNextFriday(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = day <= 5 ? 5 - day : 6; // days until next Friday
  // If today is Sat/Sun, advance to next Friday
  const friday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday),
  ));
  return Math.floor(friday.getTime() / 1000);
}

async function fetchOptionsChain(symbol: string, date: number): Promise<OptionsChainResult | null> {
  try {
    return await yf.options(symbol, { date }) as OptionsChainResult;
  } catch (err) {
    console.warn(
      `[options-flow] Failed to fetch ${symbol}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

function analyzeChain(
  symbol: string,
  result: OptionsChainResult,
): UnusualContract[] {
  const unusual: UnusualContract[] = [];
  const price = result.quote?.regularMarketPrice;
  if (!price) return unusual;

  const allContracts: (OptionsContract & { type: "Call" | "Put" })[] = [
    ...(result.options[0]?.calls ?? []).map((c) => ({ ...c, type: "Call" as const })),
    ...(result.options[0]?.puts ?? []).map((p) => ({ ...p, type: "Put" as const })),
  ];

  for (const c of allContracts) {
    const volume = c.volume ?? 0;
    const oi = c.openInterest ?? 0;
    if (volume < MIN_ABSOLUTE_VOLUME || oi < MIN_OPEN_INTEREST) continue;

    const ratio = volume / oi;
    if (ratio < VOL_OI_RATIO_THRESHOLD) continue;

    const isOTM =
      c.type === "Call"
        ? c.strike > price * OTM_FACTOR
        : c.strike < price * (2 - OTM_FACTOR); // 10% below for puts

    unusual.push({
      strike: c.strike,
      expiry: c.expiration
        ? (c.expiration instanceof Date ? c.expiration : new Date(c.expiration)).toISOString().slice(0, 10)
        : "unknown",
      type: c.type,
      volume,
      openInterest: oi,
      volOiRatio: Math.round(ratio * 100) / 100,
      isOTM,
    });
  }

  return unusual;
}

function generateSignals(
  symbol: string,
  contracts: UnusualContract[],
): RawSignal[] {
  if (contracts.length === 0) return [];

  const signals: RawSignal[] = [];
  const calls = contracts.filter((c) => c.type === "Call");
  const otmCalls = calls.filter((c) => c.isOTM);

  // Pattern 1: Unusual Call Volume (pick the highest vol/OI call)
  if (calls.length > 0) {
    const top = calls.reduce((a, b) => (a.volOiRatio > b.volOiRatio ? a : b));
    signals.push({
      symbol,
      source: "OPTIONS_FLOW",
      title: `Unusual call volume: ${symbol} $${top.strike} ${top.expiry}`,
      body: `Vol ${top.volume.toLocaleString()} vs OI ${top.openInterest.toLocaleString()} (${top.volOiRatio}x ratio). ${calls.length} unusual call contract(s) detected.`,
      optionType: "Call",
      optionVolume: top.volume,
      openInterest: top.openInterest,
      volOiRatio: top.volOiRatio,
    });
  }

  // Pattern 2: Heavy OTM Calls (2+ distinct OTM strikes with unusual volume)
  if (otmCalls.length >= 2) {
    const totalVol = otmCalls.reduce((sum, c) => sum + c.volume, 0);
    const strikes = otmCalls.map((c) => `$${c.strike}`).join(", ");
    signals.push({
      symbol,
      source: "OPTIONS_FLOW",
      title: `Heavy OTM call activity: ${symbol} (${otmCalls.length} strikes)`,
      body: `OTM strikes with unusual volume: ${strikes}. Combined volume: ${totalVol.toLocaleString()} contracts.`,
      optionType: "Call",
      optionVolume: totalVol,
      openInterest: otmCalls.reduce((sum, c) => sum + c.openInterest, 0),
      volOiRatio: Math.round(
        (otmCalls.reduce((sum, c) => sum + c.volOiRatio, 0) / otmCalls.length) * 100
      ) / 100,
    });
  }

  // Pattern 3: Call Sweep (3+ distinct strikes on the same expiry)
  const expiryGroups = new Map<string, UnusualContract[]>();
  for (const c of calls) {
    const group = expiryGroups.get(c.expiry) ?? [];
    group.push(c);
    expiryGroups.set(c.expiry, group);
  }
  for (const [expiry, group] of expiryGroups) {
    if (group.length >= SWEEP_MIN_STRIKES) {
      const totalVol = group.reduce((sum, c) => sum + c.volume, 0);
      const strikes = group.map((c) => `$${c.strike}`).sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1))).join(", ");
      signals.push({
        symbol,
        source: "OPTIONS_FLOW",
        title: `Call sweep detected: ${symbol} ${expiry} (${group.length} strikes)`,
        body: `Systematic call buying across strikes ${strikes}. Total volume: ${totalVol.toLocaleString()} contracts.`,
        optionType: "Call",
        optionVolume: totalVol,
        openInterest: group.reduce((sum, c) => sum + c.openInterest, 0),
        volOiRatio: Math.round(
          (group.reduce((sum, c) => sum + c.volOiRatio, 0) / group.length) * 100
        ) / 100,
      });
      break; // one sweep signal per symbol
    }
  }

  return signals;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchOptionsFlowSignals(): Promise<RawSignal[]> {
  console.log("Options Flow: scanning", SCAN_SYMBOLS.length, "symbols...");
  const signals: RawSignal[] = [];
  const nextFriday = getNextFriday();

  for (let i = 0; i < SCAN_SYMBOLS.length; i += BATCH_SIZE) {
    const batch = SCAN_SYMBOLS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((symbol) => fetchOptionsChain(symbol, nextFriday))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status !== "fulfilled" || !result.value) continue;

      const symbol = batch[j];
      const unusual = analyzeChain(symbol, result.value);
      const symbolSignals = generateSignals(symbol, unusual);
      signals.push(...symbolSignals);
    }

    // Rate limit between batches (skip delay after last batch)
    if (i + BATCH_SIZE < SCAN_SYMBOLS.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`Options Flow: ${signals.length} signals from ${SCAN_SYMBOLS.length} symbols`);
  return signals;
}
