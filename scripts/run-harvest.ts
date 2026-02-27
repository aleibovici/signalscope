import "dotenv/config";
import { orchestrateScan } from "../src/lib/harvester/index.js";

async function main() {
  console.log("=== SignalScope Harvester ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  const scanId = await orchestrateScan();

  console.log(`Scan completed: ${scanId}`);
  console.log(`Finished at: ${new Date().toISOString()}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Harvester failed:", err);
  process.exit(1);
});
