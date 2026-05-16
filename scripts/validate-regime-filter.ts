import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  HIGH_CONV_TITLE_PREFIXES,
  SCAN_OF_CONV_DELTA_P85,
  REGIME_TRAILING_WINDOW,
} from "../src/lib/harvester/regime-filter";

/**
 * Backtest the macro options-flow regime filter against historical SignalScope data.
 *
 * For every COMPLETED scan, retroactively compute scanOfHighConv + 5-scan trailing mean + delta,
 * join with TickerPerformance.return3d, split into flagged (delta > p85) vs un-flagged, and
 * report mean/median 3d returns per bucket.
 *
 * Mirrors autoresearch-macos/exp668_standalone.py logic 1:1 — used to cross-check that our
 * TS module reproduces the harness's claim before flipping REGIME_SKIP_ENABLED in production.
 *
 * Harness reference (May-16 dataset, exp668):
 *   unfiltered    ls_3d = +0.0025
 *   un-flagged    ls_3d = +0.0048   (n=7508, 94.4%)
 *   flagged-only  ls_3d = -0.0113   (n=448,  5.6%)
 */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

function isHighConvTitle(title: string | null): boolean {
  if (!title) return false;
  return HIGH_CONV_TITLE_PREFIXES.some((p) => title.startsWith(p));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmt(x: number, dp = 4): string {
  return Number.isNaN(x) ? "  N/A  " : (x >= 0 ? "+" : "") + x.toFixed(dp);
}

async function main() {
  console.log("=== Regime filter backtest ===");
  console.log(`Threshold: scan_of_conv_delta > ${SCAN_OF_CONV_DELTA_P85}`);
  console.log(`Trailing window: ${REGIME_TRAILING_WINDOW} prior scans\n`);

  // 1. Pull all COMPLETED scans in chronological order
  const scans = await prisma.scan.findMany({
    where: { status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true },
  });
  console.log(`Loaded ${scans.length} completed scans`);

  // 2. Count high-conv OPTIONS_FLOW signals per scan
  const scanHighConv = new Map<string, number>();
  for (const scan of scans) {
    const sigs = await prisma.signal.findMany({
      where: { scanId: scan.id, source: "OPTIONS_FLOW" },
      select: { title: true },
    });
    const count = sigs.filter((s) => isHighConvTitle(s.title)).length;
    scanHighConv.set(scan.id, count);
  }

  // 3. For each scan: compute trailing-5 mean and delta from the chronological position
  const scanDelta = new Map<string, { highConv: number; trailing: number; delta: number; flagged: boolean }>();
  for (let i = 0; i < scans.length; i++) {
    const scan = scans[i];
    const highConv = scanHighConv.get(scan.id) ?? 0;
    const windowStart = Math.max(0, i - REGIME_TRAILING_WINDOW);
    const windowScans = scans.slice(windowStart, i); // prior scans only, shift-by-1 like the harness
    const trailing = windowScans.length === 0
      ? 0
      : windowScans.reduce((s, w) => s + (scanHighConv.get(w.id) ?? 0), 0) / windowScans.length;
    const delta = highConv - trailing;
    scanDelta.set(scan.id, {
      highConv,
      trailing,
      delta,
      flagged: delta > SCAN_OF_CONV_DELTA_P85,
    });
  }

  const totalFlagged = [...scanDelta.values()].filter((d) => d.flagged).length;
  const pctFlagged = (totalFlagged / scans.length) * 100;
  console.log(`Flagged scans: ${totalFlagged}/${scans.length} (${pctFlagged.toFixed(1)}%)\n`);

  // Empirical distribution of delta — helps recalibrate the threshold to local data
  const deltas = [...scanDelta.values()].map((d) => d.delta).sort((a, b) => a - b);
  const pct = (p: number) => deltas[Math.min(deltas.length - 1, Math.floor((p / 100) * deltas.length))];
  console.log("Delta percentiles across all scans:");
  for (const p of [50, 75, 85, 90, 95, 99]) {
    console.log(`  p${p}: ${pct(p).toFixed(2)}`);
  }
  console.log(`  max: ${deltas[deltas.length - 1].toFixed(2)}\n`);

  // 4. Pull all ValidatedTicker + TickerPerformance rows for these scans.
  //    Exclude corporate-action-detected rows (per CLAUDE.md / src/lib/snapshots).
  const tickers = await prisma.validatedTicker.findMany({
    where: {
      scanId: { in: scans.map((s) => s.id) },
      performance: {
        return3d: { not: null },
        corporateActionDetected: false,
      },
    },
    select: {
      scanId: true,
      stage: true,
      performance: { select: { return3d: true } },
    },
  });
  console.log(`Loaded ${tickers.length} tickers with usable return3d`);

  // 5. Split returns into unfiltered / un-flagged / flagged-only buckets.
  //    Use only EARLY/FORMING/CONFIRMED — UNSCORED + FILTERED are noise the filter wasn't
  //    meant to touch (UNSCORED is single-mention; FILTERED is already P&D-suppressed).
  const all: number[] = [];
  const unFlagged: number[] = [];
  const flaggedOnly: number[] = [];

  for (const t of tickers) {
    if (!t.performance || t.performance.return3d == null) continue;
    if (!["EARLY", "FORMING", "CONFIRMED"].includes(t.stage)) continue;
    const r = t.performance.return3d;
    const d = scanDelta.get(t.scanId);
    if (!d) continue;
    all.push(r);
    if (d.flagged) flaggedOnly.push(r);
    else unFlagged.push(r);
  }

  // 6. Print comparison
  console.log("\nReturn3d distribution (EARLY/FORMING/CONFIRMED only, excluding corp actions):");
  console.log(pad("bucket", 16) + pad("n", 8) + pad("mean", 10) + pad("median", 10));
  console.log("-".repeat(44));
  console.log(pad("unfiltered", 16) + pad(String(all.length), 8) + pad(fmt(mean(all)), 10) + pad(fmt(median(all)), 10));
  console.log(pad("un-flagged", 16) + pad(String(unFlagged.length), 8) + pad(fmt(mean(unFlagged)), 10) + pad(fmt(median(unFlagged)), 10));
  console.log(pad("flagged-only", 16) + pad(String(flaggedOnly.length), 8) + pad(fmt(mean(flaggedOnly)), 10) + pad(fmt(median(flaggedOnly)), 10));

  // 7. Threshold sweep — show flagged-only vs un-flagged at alternate cutoffs
  console.log("\nThreshold sweep (return3d per bucket):");
  console.log(pad("threshold", 12) + pad("flagged%", 10) + pad("un-flagged", 14) + pad("flagged-only", 14) + "gap");
  console.log("-".repeat(60));
  for (const t of [SCAN_OF_CONV_DELTA_P85, 6.20, 7.00, 9.20]) {
    const buckets = { un: [] as number[], fl: [] as number[] };
    for (const ticker of tickers) {
      if (!ticker.performance || ticker.performance.return3d == null) continue;
      if (!["EARLY", "FORMING", "CONFIRMED"].includes(ticker.stage)) continue;
      const d = scanDelta.get(ticker.scanId);
      if (!d) continue;
      (d.delta > t ? buckets.fl : buckets.un).push(ticker.performance.return3d);
    }
    const flaggedScans = [...scanDelta.values()].filter((d) => d.delta > t).length;
    const pctF = (flaggedScans / scans.length) * 100;
    const mU = mean(buckets.un);
    const mF = mean(buckets.fl);
    console.log(
      pad(`> ${t.toFixed(2)}`, 12) +
      pad(`${pctF.toFixed(1)}%`, 10) +
      pad(`${fmt(mU)} (n=${buckets.un.length})`, 14) +
      pad(`${fmt(mF)} (n=${buckets.fl.length})`, 14) +
      fmt(mU - mF)
    );
  }

  // 8. Pass/fail vs harness expectations
  console.log("\nValidation (at configured threshold):");
  const meanAll = mean(all);
  const meanUn = mean(unFlagged);
  const meanFl = mean(flaggedOnly);
  const checks: Array<[string, boolean]> = [
    [`pct_flagged in [3%, 10%]: ${pctFlagged.toFixed(1)}%`, pctFlagged >= 3 && pctFlagged <= 10],
    [`un-flagged mean >= unfiltered mean: ${fmt(meanUn)} >= ${fmt(meanAll)}`, meanUn >= meanAll],
    [`flagged-only mean < un-flagged mean: ${fmt(meanFl)} < ${fmt(meanUn)}`, meanFl < meanUn],
    [`flagged-only sample n >= 50 (for signal stability)`, flaggedOnly.length >= 50],
  ];
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  }

  const allPass = checks.every(([, p]) => p);
  console.log(`\n${allPass ? "READY" : "NOT READY"} to flip REGIME_SKIP_ENABLED=true`);

  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(2);
});
