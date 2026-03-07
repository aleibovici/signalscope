import { prisma } from "@/lib/prisma";

const DEVIATION_THRESHOLD = 0.05; // 5%

/**
 * Check if a user-reported price is within 5% of the latest snapshot price
 * for the given symbol. Returns true (verified) if within range or if no
 * snapshot exists (benefit of the doubt for symbols we don't track).
 */
export async function verifyPriceAgainstSnapshot(
  symbol: string,
  reportedPrice: number
): Promise<boolean> {
  const snapshot = await prisma.priceSnapshot.findFirst({
    where: { symbol },
    orderBy: { createdAt: "desc" },
    select: { price: true },
  });

  if (!snapshot) return true; // No snapshot data — can't verify, allow it

  const deviation = Math.abs(reportedPrice - snapshot.price) / snapshot.price;
  return deviation <= DEVIATION_THRESHOLD;
}
