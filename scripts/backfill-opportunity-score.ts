import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { computeOpportunityScore } from "../src/lib/harvester/opportunity-score.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const BATCH_SIZE = 500;

async function main() {
  let cursor: string | undefined;
  let updated = 0;

  for (;;) {
    const tickers = await prisma.validatedTicker.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        aiScore: true,
        firstSeenDaysAgo: true,
        priorAppearances: true,
        avgVelocity: true,
        price: true,
        marketCap: true,
        wk52Lo: true,
        wk52Hi: true,
        medianSignalAgeHrs: true,
        shortFloat: true,
        sourceCount: true,
        stage: true,
      },
    });

    if (tickers.length === 0) break;

    const updates = tickers.map((t) => {
      const score = computeOpportunityScore({
        aiScore: t.aiScore,
        firstSeenDaysAgo: t.firstSeenDaysAgo,
        priorAppearances: t.priorAppearances,
        avgVelocity: t.avgVelocity ?? 0,
        price: t.price,
        marketCap: t.marketCap,
        wk52Lo: t.wk52Lo,
        wk52Hi: t.wk52Hi,
        medianSignalAgeHrs: t.medianSignalAgeHrs,
        shortFloat: t.shortFloat,
        sourceCount: t.sourceCount,
        stage: t.stage,
      });
      return prisma.validatedTicker.update({
        where: { id: t.id },
        data: { opportunityScore: score },
      });
    });

    await prisma.$transaction(updates);
    updated += tickers.length;
    cursor = tickers[tickers.length - 1].id;
    console.log(`Updated ${updated} tickers...`);
  }

  console.log(`Done. Total updated: ${updated}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
