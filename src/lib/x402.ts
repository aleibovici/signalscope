import { x402ResourceServer, withX402 } from "@x402/next";
import type { RouteConfig } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const X402_WALLET = process.env.X402_WALLET_ADDRESS as `0x${string}`;
export const X402_ENABLED = !!process.env.X402_WALLET_ADDRESS;

const X402_NETWORK = "eip155:8453" as const; // Base mainnet

export const x402Server = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: "https://api.bitrefill.com/x402" }),
).register(X402_NETWORK, new ExactEvmScheme());

/**
 * Check if the request carries standard auth credentials
 * (session cookie, Bearer token, or API key).
 */
export function hasAuthCredentials(req: NextRequest): boolean {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return true;
  if (req.headers.get("x-api-key")) return true;
  if (req.cookies.get("authjs.session-token")) return true;
  if (req.cookies.get("__Secure-authjs.session-token")) return true;
  return false;
}

export const x402RouteConfigs = {
  trending: {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Trending breakout signals with AI scores and performance data",
  },
  report: {
    accepts: {
      scheme: "exact",
      price: "$0.05",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "AI-generated ticker analysis report with trade setup",
  },
  ticker: {
    accepts: {
      scheme: "exact",
      price: "$0.005",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Latest ticker data with raw signals",
  },
  related: {
    accepts: {
      scheme: "exact",
      price: "$0.005",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Co-occurring tickers with Jaccard correlation scores",
  },
  history: {
    accepts: {
      scheme: "exact",
      price: "$0.005",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Historical scan appearances for a ticker",
  },
  performance: {
    accepts: {
      scheme: "exact",
      price: "$0.005",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Price performance tracking with return data",
  },
  network: {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: X402_NETWORK,
      payTo: X402_WALLET,
    },
    description: "Ticker co-occurrence network graph with nodes and edges",
  },
};

export async function logX402Payment(
  req: NextRequest,
  endpoint: string,
  amountUsd: string,
): Promise<void> {
  let payerAddress: string | null = null;
  const xPaymentHeader = req.headers.get("x-payment");
  if (xPaymentHeader) {
    try {
      const payload = JSON.parse(
        Buffer.from(xPaymentHeader, "base64").toString("utf-8"),
      );
      // EIP-3009 transferWithAuthorization has `from` field in the payload
      payerAddress = (payload?.payload?.from as string) ?? null;
    } catch {
      // best-effort — don't block the response
    }
  }
  await prisma.x402Payment.create({
    data: { endpoint, amountUsd, payerAddress },
  });
}

/**
 * Like withX402, but also logs each successful payment to the X402Payment table.
 * Payment is logged after verification (before settlement), so it records
 * "verified" payments — settlement failures are extremely rare.
 */
export function withX402Logged<T = unknown>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  routeConfig: RouteConfig,
  endpoint: string,
): (request: NextRequest) => Promise<NextResponse<T>> {
  const accepts = Array.isArray(routeConfig.accepts)
    ? routeConfig.accepts[0]
    : routeConfig.accepts;
  const amountUsd = String(accepts.price).replace("$", "");
  const logged = async (request: NextRequest): Promise<NextResponse<T>> => {
    logX402Payment(request, endpoint, amountUsd).catch((err) =>
      console.error("[x402] payment log error:", err),
    );
    return handler(request);
  };
  return withX402(logged, routeConfig, x402Server);
}

export { withX402 };
