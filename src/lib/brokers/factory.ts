import type { BrokerClient } from "./interface";
import { AlpacaClient } from "./alpaca/client";

export type BrokerProvider = "alpaca"; // extend as: "alpaca" | "ibkr" | "tradier"

export function isConfigured(): boolean {
  return !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
}

/**
 * Returns a BrokerClient for the configured provider.
 * Phase 1: always Alpaca, credentials from env vars.
 * Phase 2: accept a `credentials` argument for per-user API keys.
 */
export function getBrokerClient(): BrokerClient {
  const provider = (process.env.BROKER_PROVIDER ?? "alpaca") as BrokerProvider;

  switch (provider) {
    case "alpaca":
      return new AlpacaClient();
    default:
      throw new Error(`Unknown broker provider: ${provider}`);
  }
}
