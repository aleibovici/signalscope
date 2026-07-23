import "dotenv/config";
import { collectSnapshots } from "../src/lib/snapshots/index.js";

/**
 * Collect forward price snapshots for tracked tickers and refresh return columns.
 *
 * Equivalent to POST /api/snapshots/collect, but runs directly against
 * DATABASE_URL so self-hosters can schedule it with plain cron instead of
 * exposing a scheduled-job endpoint.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  console.log(`[snapshots] Starting at ${new Date().toISOString()}`);
  const t0 = Date.now();
  const stats = await collectSnapshots();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(
    `[snapshots] Completed in ${elapsed}s — ${stats.filled} filled, ${stats.errors} errors, ` +
      `${stats.skipped} skipped, ${stats.returnsUpdated} returns updated`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[snapshots] Failed:", err);
  process.exit(1);
});
