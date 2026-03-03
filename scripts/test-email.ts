import "dotenv/config";
import { sendConfirmedTickerAlerts } from "../src/lib/email/index.js";

const fakeTickers = [
  { symbol: "NVDA", price: 142.5, aiScore: 82, catalyst: "Record AI chip demand; data center revenue +150% YoY", signalType: "multi_source" },
  { symbol: "PLTR", price: 24.8, aiScore: 71, catalyst: "Major DoD contract win; AIP adoption accelerating", signalType: "insider_buy" },
  { symbol: "SMCI", price: 38.2, aiScore: 68, catalyst: "AI server backlog growing; partnership with NVDA expanding", signalType: "volume_spike" },
];

async function main() {
  console.log("=== Email Alert Test ===");
  console.log("Sending digest with 3 fake confirmed tickers...\n");

  await sendConfirmedTickerAlerts(fakeTickers);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
