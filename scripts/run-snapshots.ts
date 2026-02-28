import "dotenv/config";
import { collectSnapshots } from "../src/lib/snapshots/index.js";

async function main() {
  console.log("=== SignalScope Price Snapshots ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  const stats = await collectSnapshots();

  console.log(`Results: ${stats.filled} filled, ${stats.errors} errors, ${stats.skipped} skipped`);
  console.log(`Finished at: ${new Date().toISOString()}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Snapshot collection failed:", err);
  process.exit(1);
});
