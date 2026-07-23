#!/usr/bin/env tsx
/**
 * Test Alpaca paper account connectivity.
 * Usage:
 *   npx tsx scripts/test-broker.ts              # show account + positions
 *   npx tsx scripts/test-broker.ts --order      # place a test bracket order on AAPL
 *   npx tsx scripts/test-broker.ts --cancel     # cancel all open orders
 */
import { config } from "dotenv";
config({ path: ".env" });

const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_SECRET_KEY;
const IS_PAPER = process.env.ALPACA_PAPER !== "false";

if (!API_KEY || !API_SECRET) {
  console.error("Missing ALPACA_API_KEY or ALPACA_SECRET_KEY in .env");
  process.exit(1);
}

const BASE_URL = IS_PAPER ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
const HEADERS = {
  "APCA-API-KEY-ID": API_KEY,
  "APCA-API-SECRET-KEY": API_SECRET,
  "Content-Type": "application/json",
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new Error(`Alpaca ${method} ${path} → ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function showAccount() {
  const acct = await request<{ equity: string; cash: string; currency: string; trading_blocked: boolean }>("GET", "/v2/account");
  console.log("\n=== Account ===");
  console.log(`  Mode:    ${IS_PAPER ? "PAPER" : "LIVE"}`);
  console.log(`  Equity:  $${parseFloat(acct.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  console.log(`  Cash:    $${parseFloat(acct.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  console.log(`  Currency: ${acct.currency}`);
  console.log(`  Trading blocked: ${acct.trading_blocked}`);
}

async function showPositions() {
  const positions = await request<{ symbol: string; qty: string; avg_entry_price: string; current_price: string; unrealized_pl: string; unrealized_plpc: string }[]>("GET", "/v2/positions");
  console.log(`\n=== Open Positions (${positions.length}) ===`);
  if (positions.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const p of positions) {
    const pnlPct = (parseFloat(p.unrealized_plpc) * 100).toFixed(2);
    const pnlSign = parseFloat(p.unrealized_pl) >= 0 ? "+" : "";
    console.log(`  ${p.symbol.padEnd(8)} qty=${p.qty.padStart(5)}  entry=$${p.avg_entry_price}  current=$${p.current_price}  P&L=${pnlSign}$${parseFloat(p.unrealized_pl).toFixed(2)} (${pnlSign}${pnlPct}%)`);
  }
}

async function showOpenOrders() {
  const orders = await request<{ id: string; symbol: string; side: string; order_class: string; status: string; limit_price: string | null; qty: string }[]>(
    "GET",
    "/v2/orders?status=open&limit=50"
  );
  const parents = orders.filter((o) => o.order_class === "bracket" || o.order_class === "simple" || !o.order_class);
  console.log(`\n=== Open Orders (${orders.length} total, ${parents.length} parent) ===`);
  if (orders.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const o of orders) {
    console.log(`  ${o.id.slice(0, 8)}  ${o.symbol.padEnd(8)} ${o.side.padEnd(5)} class=${o.order_class ?? "simple"}  qty=${o.qty}  limit=${o.limit_price ?? "–"}  status=${o.status}`);
  }
}

async function placeTestOrder() {
  console.log("\n=== Placing test bracket order on AAPL ===");
  // Use a very low limit so it stays pending (won't actually fill)
  const body = {
    symbol: "AAPL",
    qty: "1",
    side: "buy",
    type: "limit",
    time_in_force: "gtc",
    limit_price: "1.00", // absurdly low — won't fill
    order_class: "bracket",
    take_profit: { limit_price: "300.00" },
    stop_loss: { stop_price: "0.50", limit_price: "0.49" },
    client_order_id: `test-${Date.now()}`,
  };
  const order = await request<{ id: string; status: string }>("POST", "/v2/orders", body);
  console.log(`  Placed! order_id=${order.id}  status=${order.status}`);
  console.log(`  (This order has a $1 limit — it will never fill on paper. Cancel it after verification.)`);
}

async function cancelAll() {
  const orders = await request<{ id: string; symbol: string }[]>("GET", "/v2/orders?status=open&limit=500");
  if (orders.length === 0) {
    console.log("No open orders to cancel.");
    return;
  }
  console.log(`\nCancelling ${orders.length} open orders...`);
  for (const o of orders) {
    await request("DELETE", `/v2/orders/${o.id}`);
    console.log(`  ✓ Cancelled ${o.symbol} (${o.id.slice(0, 8)})`);
  }
}

const args = process.argv.slice(2);

(async () => {
  try {
    await showAccount();
    await showPositions();
    await showOpenOrders();

    if (args.includes("--order")) {
      await placeTestOrder();
      await showOpenOrders();
    }

    if (args.includes("--cancel")) {
      await cancelAll();
    }

    console.log("\nDone.\n");
  } catch (err) {
    console.error("\n[ERROR]", err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
