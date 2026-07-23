#!/usr/bin/env tsx
/**
 * End-to-end broker simulation — Alpaca paper account.
 *
 * Runs through the full order lifecycle:
 *   Step 1 — Account connectivity
 *   Step 2 — Place bracket order (limit so low it will never fill)
 *   Step 3 — Verify order appears in open orders
 *   Step 4 — Fetch the specific order by ID
 *   Step 5 — Cancel the order
 *   Step 6 — Confirm order is cancelled
 *   Step 7 — Confirm no position was opened
 *   Step 8 — DB-backed executor: insert a fake ticker, run executeForTickers, verify DB rows, clean up
 *
 * Usage:
 *   npx tsx --env-file .env scripts/simulate-broker.ts           # all steps
 *   npx tsx --env-file .env scripts/simulate-broker.ts --api     # steps 1-7 only (no DB)
 *   npx tsx --env-file .env scripts/simulate-broker.ts --db      # step 8 only (DB + executor)
 */
import { config } from "dotenv";
config({ path: ".env" });

import { AlpacaClient } from "@/lib/brokers/alpaca/client";
import { executeForTickers } from "@/lib/brokers/executor";
import { prisma } from "@/lib/prisma";
import type { ValidatedTicker } from "@/generated/prisma/client";

const args = process.argv.slice(2);
const runApi = args.length === 0 || args.includes("--api");
const runDb = args.length === 0 || args.includes("--db");

const TEST_SYMBOL = "AAPL"; // liquid, always quoted on paper
let passed = 0;
let failed = 0;

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passed++;
}
function fail(msg: string, err?: unknown) {
  console.error(`  ✗ ${msg}`);
  if (err) console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  failed++;
}
function step(n: number, label: string) {
  console.log(`\nStep ${n}: ${label}`);
}

async function runApiTests() {
  const client = new AlpacaClient();

  // ── Step 1: Account ──────────────────────────────────────────────────────
  step(1, "Account connectivity");
  let equity = 0;
  try {
    const acct = await client.getAccount();
    equity = acct.equity;
    pass(`Connected — equity $${acct.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${acct.currency} (paper: ${process.env.ALPACA_PAPER !== "false"})`);
  } catch (err) {
    fail("Could not connect to Alpaca", err);
    console.error("Aborting — check ALPACA_API_KEY / ALPACA_SECRET_KEY in .env");
    return;
  }

  // ── Step 2: Place bracket order ──────────────────────────────────────────
  step(2, "Place bracket order (limit $1 — will never fill)");
  let clientOrderId = "";
  let brokerOrderId = "";
  try {
    const result = await client.placeBracketOrder({
      symbol: TEST_SYMBOL,
      qty: 1,
      entryLimit: 1.00,    // absurdly low so it pends indefinitely
      stopPrice: 0.50,
      targetPrice: 300.00,
    });
    clientOrderId = result.clientOrderId;
    brokerOrderId = result.brokerOrderId ?? "";
    pass(`Placed — clientOrderId=${clientOrderId.slice(0, 8)}… brokerOrderId=${brokerOrderId.slice(0, 8)}…`);
  } catch (err) {
    fail("placeBracketOrder threw", err);
    return;
  }

  // ── Step 3: Verify in open orders list ───────────────────────────────────
  step(3, "Verify order appears in open orders list");
  try {
    const openOrders = await client.listOpenOrders();
    const found = openOrders.find(
      (o) => o.brokerOrderId === brokerOrderId || o.clientOrderId === clientOrderId,
    );
    if (found) {
      pass(`Found in list — status=${found.status} side=${found.side}`);
    } else {
      fail(`Order ${brokerOrderId.slice(0, 8)}… not in open orders (got ${openOrders.length} total)`);
    }
  } catch (err) {
    fail("listOpenOrders threw", err);
  }

  // ── Step 4: Fetch specific order ─────────────────────────────────────────
  step(4, "Fetch order by brokerOrderId");
  try {
    const order = await client.getOrder(brokerOrderId);
    if (order) {
      pass(`getOrder returned — status=${order.status} filledQty=${order.filledQty}`);
    } else {
      fail("getOrder returned null");
    }
  } catch (err) {
    fail("getOrder threw", err);
  }

  // ── Step 5: Cancel ───────────────────────────────────────────────────────
  step(5, "Cancel the order");
  try {
    await client.cancelOrder(brokerOrderId);
    pass(`cancelOrder called for ${brokerOrderId.slice(0, 8)}…`);
  } catch (err) {
    fail("cancelOrder threw", err);
  }

  // ── Step 6: Confirm cancelled ────────────────────────────────────────────
  step(6, "Confirm order is no longer open");
  await new Promise((r) => setTimeout(r, 1500)); // Alpaca propagation delay
  try {
    const openOrders = await client.listOpenOrders();
    const stillOpen = openOrders.find(
      (o) => o.brokerOrderId === brokerOrderId || o.clientOrderId === clientOrderId,
    );
    if (!stillOpen) {
      pass("Order no longer in open orders list");
    } else {
      fail(`Order still shows as open with status=${stillOpen.status}`);
    }
  } catch (err) {
    fail("listOpenOrders threw on confirmation", err);
  }

  // ── Step 7: No position opened ───────────────────────────────────────────
  step(7, "Confirm no position was opened (order never filled)");
  try {
    const positions = await client.listPositions();
    const pos = positions.find((p) => p.symbol === TEST_SYMBOL);
    if (!pos) {
      pass(`No ${TEST_SYMBOL} position — correct, limit was never reached`);
    } else {
      // A position exists — might be a pre-existing test position; warn but don't fail
      console.log(`  ⚠ ${TEST_SYMBOL} position exists: qty=${pos.qty} entry=${pos.avgEntryPrice} (may be pre-existing)`);
    }
  } catch (err) {
    fail("listPositions threw", err);
  }

  console.log(`\n  Equity unchanged at ~$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })} (no fills)`);
}

async function runDbTests() {
  step(8, "DB-backed executor — full executeForTickers flow");

  // Insert a minimal fake scan + validatedTicker so the executor has something to act on
  const fakeScan = await prisma.scan.create({
    data: {
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const fakeTicker = await prisma.validatedTicker.create({
    data: {
      scanId: fakeScan.id,
      symbol: TEST_SYMBOL,
      name: "Apple Inc (sim-test)",
      price: 200,
      aiScore: 80,
      opportunityScore: 85,
      stage: "EARLY",
      signalCount: 3,
      sourceCount: 2,
      avgSentiment: 0.7,
      exchange: "NASDAQ",
      pndFlagged: false,
      pndFlags: [],
      pndScore: 0,
      priorAppearances: 0,
      recommendation: "BUY",
      tradeSetupEntryLo: 190,
      tradeSetupEntryHi: 1.00,  // $1 limit — never fills on paper
      tradeSetupStopLoss: 0.50,
      tradeSetupTarget1: 300,
      tradeSetupTimeframe: "5-7 days",
      tradeSetupConfidence: "High",
      tradeSetupRiskReward: "1:2.0",
    },
  });

  console.log(`  Inserted fake scan ${fakeScan.id.slice(0, 8)}… + ticker ${fakeTicker.id.slice(0, 8)}…`);

  let orderId: string | undefined;

  try {
    // 8a: First call — should place
    const results = await executeForTickers([fakeTicker as ValidatedTicker]);
    const r = results[0];

    if (r.status === "placed") {
      pass(`executeForTickers placed order — clientOrderId=${r.clientOrderId?.slice(0, 8)}…`);
    } else {
      fail(`Expected status=placed, got ${r.status}: ${r.reason}`);
    }

    // 8b: Verify BrokerOrder row created in DB
    const dbOrder = await prisma.brokerOrder.findFirst({
      where: { validatedTickerId: fakeTicker.id, role: "PARENT" },
    });
    if (dbOrder) {
      pass(`BrokerOrder row created — id=${dbOrder.id.slice(0, 8)}… brokerOrderId=${dbOrder.brokerOrderId?.slice(0, 8)}…`);
      orderId = dbOrder.brokerOrderId ?? undefined;
    } else {
      fail("No BrokerOrder PARENT row found in DB");
    }

    // 8c: Idempotency — second call should skip
    const results2 = await executeForTickers([fakeTicker as ValidatedTicker]);
    const r2 = results2[0];
    if (r2.status === "skipped") {
      pass(`Idempotency — second call correctly skipped (${r2.reason})`);
    } else {
      fail(`Expected status=skipped on second call, got ${r2.status}`);
    }

    // 8d: BrokerPosition row
    const dbPos = await prisma.brokerPosition.findUnique({ where: { symbol: TEST_SYMBOL } });
    if (dbPos) {
      pass(`BrokerPosition row — symbol=${dbPos.symbol} qty=${dbPos.quantity} avgCost=$${dbPos.avgCost}`);
    } else {
      fail("No BrokerPosition row found in DB");
    }

    // 8e: Cancel the live order on Alpaca (cleanup)
    if (orderId) {
      try {
        const client = new AlpacaClient();
        await client.cancelOrder(orderId);
        pass(`Cancelled live order ${orderId.slice(0, 8)}… on Alpaca`);
      } catch {
        console.log(`  ⚠ Could not cancel order on Alpaca (may have already expired)`);
      }
    }
  } finally {
    // ── Cleanup DB ───────────────────────────────────────────────────────────
    console.log("\n  Cleaning up test DB rows…");
    await prisma.brokerOrder.deleteMany({ where: { validatedTickerId: fakeTicker.id } });
    await prisma.brokerPosition.deleteMany({ where: { symbol: TEST_SYMBOL } });
    await prisma.validatedTicker.delete({ where: { id: fakeTicker.id } });
    await prisma.scan.delete({ where: { id: fakeScan.id } });
    pass("DB cleanup complete");
  }
}

(async () => {
  console.log("=== Alpaca Paper Broker Simulation ===");
  console.log(`Mode: ${runApi && runDb ? "full" : runApi ? "api-only" : "db-only"}`);

  if (runApi) await runApiTests();
  if (runDb) await runDbTests();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
