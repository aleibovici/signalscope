import type { RawSignal } from "../types";

export async function fetchStockTwitsSignals(): Promise<RawSignal[]> {
  // StockTwits is fully behind Cloudflare protection — both API and website return 403.
  // No fix without browser automation. Returning empty; cross-source scoring handles this gracefully.
  console.warn("StockTwits: source unavailable (Cloudflare-protected). Skipping.");
  return [];
}
