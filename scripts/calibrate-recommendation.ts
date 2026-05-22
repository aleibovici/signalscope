// One-shot calibration: for each candidate recommendation rule, compute
// hit-rate and mean realized 3d/7d return on the last 90d of TickerPerformance.
// Run: npx tsx scripts/calibrate-recommendation.ts

import { prisma } from "@/lib/prisma";

interface Row {
  symbol: string;
  aiScore: number;
  stage: string;
  sourceCount: number;
  hasCatalystSource: boolean;
  pndFlagged: boolean;
  price: number | null;
  return3d: number | null;
  return7d: number | null;
}

async function main() {
  const since = new Date(Date.now() - 90 * 86400000);

  const perf = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: since },
      corporateActionDetected: false,
    },
    select: {
      return3d: true,
      return7d: true,
      validatedTicker: {
        select: {
          symbol: true,
          scanId: true,
          aiScore: true,
          stage: true,
          sourceCount: true,
          pndFlagged: true,
          price: true,
        },
      },
    },
  });

  // ValidatedTicker has no direct signals relation; query Signal separately
  // and key by `${scanId}|${symbol}` to build the catalyst-source set.
  const CATALYST = new Set(["SEC_INSIDER", "OPTIONS_FLOW", "CONGRESS"]);
  const vtPairs = perf
    .map((p) => p.validatedTicker)
    .filter((vt): vt is NonNullable<typeof vt> => vt !== null);
  const scanIds = [...new Set(vtPairs.map((vt) => vt.scanId))];
  const symbols = [...new Set(vtPairs.map((vt) => vt.symbol))];

  console.log(`Joining signals across ${scanIds.length} scans, ${symbols.length} symbols…`);
  const sigs = await prisma.signal.findMany({
    where: {
      scanId: { in: scanIds },
      symbol: { in: symbols },
      source: { in: ["SEC_INSIDER", "OPTIONS_FLOW", "CONGRESS"] },
    },
    select: { scanId: true, symbol: true, source: true },
  });
  const catalystKeys = new Set<string>();
  for (const s of sigs) {
    if (CATALYST.has(s.source)) catalystKeys.add(`${s.scanId}|${s.symbol}`);
  }

  const rows: Row[] = perf
    .filter((p) => p.validatedTicker !== null)
    .map((p) => {
      const vt = p.validatedTicker!;
      return {
        symbol: vt.symbol,
        aiScore: vt.aiScore ?? 0,
        stage: vt.stage,
        sourceCount: vt.sourceCount ?? 0,
        hasCatalystSource: catalystKeys.has(`${vt.scanId}|${vt.symbol}`),
        pndFlagged: vt.pndFlagged ?? false,
        price: vt.price,
        return3d: p.return3d,
        return7d: p.return7d,
      };
    });

  console.log(`\nLoaded ${rows.length} performance rows (last 90d, no corp actions).\n`);

  function evaluate(label: string, predicate: (r: Row) => boolean) {
    const matched = rows.filter(predicate);
    const with3d = matched.filter((r) => r.return3d !== null);
    const with7d = matched.filter((r) => r.return7d !== null);
    const mean3d = with3d.length ? with3d.reduce((s, r) => s + (r.return3d as number), 0) / with3d.length : 0;
    const mean7d = with7d.length ? with7d.reduce((s, r) => s + (r.return7d as number), 0) / with7d.length : 0;
    const hit3d = with3d.length ? with3d.filter((r) => (r.return3d as number) > 0).length / with3d.length : 0;
    const hit7d = with7d.length ? with7d.filter((r) => (r.return7d as number) > 0).length / with7d.length : 0;
    console.log(
      `${label.padEnd(50)} n=${String(matched.length).padStart(5)}  ` +
        `mean3d=${(mean3d * 100).toFixed(2).padStart(7)}%  hit3d=${(hit3d * 100).toFixed(1).padStart(5)}%  ` +
        `mean7d=${(mean7d * 100).toFixed(2).padStart(7)}%  hit7d=${(hit7d * 100).toFixed(1).padStart(5)}%`
    );
  }

  console.log("== Strong Buy candidates ==");
  evaluate("CONFIRMED + catalyst + src>=3 + score>=70", (r) =>
    r.stage === "CONFIRMED" && r.hasCatalystSource && r.sourceCount >= 3 && r.aiScore >= 70
  );
  evaluate("CONFIRMED + catalyst + src>=3 + score>=75", (r) =>
    r.stage === "CONFIRMED" && r.hasCatalystSource && r.sourceCount >= 3 && r.aiScore >= 75
  );
  evaluate("CONFIRMED + catalyst + src>=2 + score>=70", (r) =>
    r.stage === "CONFIRMED" && r.hasCatalystSource && r.sourceCount >= 2 && r.aiScore >= 70
  );

  console.log("\n== Buy candidates ==");
  evaluate("CONFIRMED + score>=60", (r) => r.stage === "CONFIRMED" && r.aiScore >= 60);
  evaluate("CONFIRMED + score>=65", (r) => r.stage === "CONFIRMED" && r.aiScore >= 65);
  evaluate("catalyst + src>=2 + score>=55", (r) => r.hasCatalystSource && r.sourceCount >= 2 && r.aiScore >= 55);
  evaluate("catalyst + src>=2 + score>=50", (r) => r.hasCatalystSource && r.sourceCount >= 2 && r.aiScore >= 50);
  evaluate("FORMING + src>=2 + score>=60", (r) => r.stage === "FORMING" && r.sourceCount >= 2 && r.aiScore >= 60);
  evaluate("FORMING + src>=2 + score>=55", (r) => r.stage === "FORMING" && r.sourceCount >= 2 && r.aiScore >= 55);

  console.log("\n== Avoid candidates ==");
  evaluate("pndFlagged=true", (r) => r.pndFlagged);
  evaluate("price < $0.12", (r) => r.price !== null && r.price < 0.12);
  evaluate("score < 20 + no catalyst", (r) => r.aiScore < 20 && !r.hasCatalystSource);
  evaluate("score < 25 + no catalyst", (r) => r.aiScore < 25 && !r.hasCatalystSource);

  console.log("\n== Baseline ==");
  evaluate("ALL rows", () => true);
  evaluate("EARLY stage", (r) => r.stage === "EARLY");
  evaluate("FORMING stage", (r) => r.stage === "FORMING");
  evaluate("CONFIRMED stage", (r) => r.stage === "CONFIRMED");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
