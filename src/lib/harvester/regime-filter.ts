import type { PrismaClient } from "@/generated/prisma/client";
import type { RawSignal } from "./types";

// Definition source: autoresearch-macos/exp668_standalone.py:42-54
//
// per OPTIONS_FLOW signal:
//   is_high_conv = title startsWith "Call sweep" OR "Heavy OTM"
// per scan:
//   scan_of_high_conv  = count(is_high_conv) across OPTIONS_FLOW signals
//   scan_of_conv_trail = rolling mean of scan_of_high_conv over previous 5 COMPLETED scans (shift-1, fillna 0)
//   scan_of_conv_delta = scan_of_high_conv - scan_of_conv_trail
//
// Threshold from exp668_run.log:44 (p85 of train+val on May-16 dataset).
// When delta > threshold the model's long-short spread inverts (flagged-only test_ic = -0.052 vs un-flagged -0.038).
export const HIGH_CONV_TITLE_PREFIXES = ["Call sweep", "Heavy OTM"] as const;
export const SCAN_OF_CONV_DELTA_P85 = 5.20;
export const REGIME_TRAILING_WINDOW = 5;

export function isRegimeSkipEnabled(): boolean {
  return process.env.REGIME_SKIP_ENABLED === "true";
}

export interface RegimeAssessment {
  skip: boolean;
  scanOfHighConv: number;
  scanOfConvTrailing: number;
  scanOfConvDelta: number;
  threshold: number;
}

export function countHighConvOptionsFlow(signals: RawSignal[]): number {
  let count = 0;
  for (const s of signals) {
    if (s.source !== "OPTIONS_FLOW" || !s.title) continue;
    if (HIGH_CONV_TITLE_PREFIXES.some((p) => s.title!.startsWith(p))) count++;
  }
  return count;
}

export async function getTrailingHighConvMean(
  prisma: PrismaClient,
  beforeScanStartedAt: Date
): Promise<number> {
  const prior = await prisma.scan.findMany({
    where: {
      status: "COMPLETED",
      scanOfHighConv: { not: null },
      startedAt: { lt: beforeScanStartedAt },
    },
    orderBy: { startedAt: "desc" },
    take: REGIME_TRAILING_WINDOW,
    select: { scanOfHighConv: true },
  });
  if (prior.length === 0) return 0;
  const sum = prior.reduce((s, r) => s + (r.scanOfHighConv ?? 0), 0);
  return sum / prior.length;
}

export function assessRegime(
  scanOfHighConv: number,
  scanOfConvTrailing: number,
  enabled: boolean = isRegimeSkipEnabled()
): RegimeAssessment {
  const scanOfConvDelta = scanOfHighConv - scanOfConvTrailing;
  return {
    skip: enabled && scanOfConvDelta > SCAN_OF_CONV_DELTA_P85,
    scanOfHighConv,
    scanOfConvTrailing,
    scanOfConvDelta,
    threshold: SCAN_OF_CONV_DELTA_P85,
  };
}

export async function assessScanRegime(
  prisma: PrismaClient,
  allSignals: RawSignal[],
  scanStartedAt: Date
): Promise<RegimeAssessment> {
  const scanOfHighConv = countHighConvOptionsFlow(allSignals);
  const scanOfConvTrailing = await getTrailingHighConvMean(prisma, scanStartedAt);
  return assessRegime(scanOfHighConv, scanOfConvTrailing);
}
