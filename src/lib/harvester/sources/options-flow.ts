import type { RawSignal } from "../types";

export async function fetchOptionsFlowSignals(): Promise<RawSignal[]> {
  // Barchart requires session auth (401) and Yahoo options causes headers overflow.
  // Options flow data requires paid APIs (Unusual Whales, FlowAlgo, etc.) to access reliably.
  // Keeping this export so a paid API can be plugged in later.
  console.warn("Options Flow: source unavailable (auth-required APIs). Skipping.");
  return [];
}
