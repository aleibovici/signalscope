import "dotenv/config";
import { fetchSignals } from "../src/lib/harvester/index.js";
import type { HarvestIngestPayload } from "../src/lib/harvester/types.js";
import { writeFileSync } from "fs";

const ENDPOINT_URL = process.env.HARVEST_ENDPOINT_URL;
const API_KEY = process.env.HARVEST_API_KEY;
const FETCH_TIMEOUT = 5 * 60 * 1000; // 5 minutes (processing takes 1-3 min)

async function postSignals(payload: HarvestIngestPayload): Promise<{ status: string; scanId: string }> {
  const payloadSize = JSON.stringify(payload).length;
  console.log(`[trace] POST ${ENDPOINT_URL} — ${payload.signals.length} signals, ${(payloadSize / 1024).toFixed(1)}KB payload`);
  const t0 = Date.now();

  const res = await fetch(ENDPOINT_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-harvest-key": API_KEY!,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[trace] Response: HTTP ${res.status} after ${elapsed}s`);
    throw new Error(`Ingest endpoint returned ${res.status}: ${text}`);
  }

  const result = await res.json();
  console.log(`[trace] Response: HTTP ${res.status} after ${elapsed}s — scanId=${result.scanId}`);
  return result;
}

async function main() {
  console.log("=== SignalScope Slim Harvester (Remote Processing) ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  if (!ENDPOINT_URL || !API_KEY) {
    console.error("Missing HARVEST_ENDPOINT_URL or HARVEST_API_KEY");
    process.exit(1);
  }

  // 1. Fetch signals locally
  console.log(`[trace] Endpoint: ${ENDPOINT_URL}`);
  console.log(`[trace] Starting local signal fetch...`);
  const fetchStart = Date.now();
  const signals = await fetchSignals();
  const fetchElapsed = ((Date.now() - fetchStart) / 1000).toFixed(1);
  console.log(`[trace] Fetch completed in ${fetchElapsed}s — ${signals.length} signals`);

  // Log source breakdown
  const sourceCounts = signals.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[trace] Source breakdown:`, JSON.stringify(sourceCounts));

  if (signals.length === 0) {
    console.log("No signals fetched — skipping remote processing");
    process.exit(0);
  }

  const payload: HarvestIngestPayload = {
    signals,
    harvestedAt: new Date().toISOString(),
  };

  // 2. POST to the web app for processing
  try {
    const result = await postSignals(payload);
    console.log(`Scan completed remotely: ${result.scanId}`);
  } catch (err) {
    console.warn(`First attempt failed: ${err instanceof Error ? err.message : err}`);
    console.log("Retrying in 5 seconds...");
    await new Promise((r) => setTimeout(r, 5000));

    try {
      const result = await postSignals(payload);
      console.log(`Scan completed remotely (retry): ${result.scanId}`);
    } catch (retryErr) {
      console.error(`Retry failed: ${retryErr instanceof Error ? retryErr.message : retryErr}`);

      // Save signals to disk for manual replay
      const dumpPath = `/tmp/signalscope-harvest-${Date.now()}.json`;
      writeFileSync(dumpPath, JSON.stringify(payload, null, 2));
      console.error(`Signals saved to ${dumpPath} for manual replay`);
      process.exit(1);
    }
  }

  console.log(`Finished at: ${new Date().toISOString()}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Slim harvester failed:", err);
  process.exit(1);
});
