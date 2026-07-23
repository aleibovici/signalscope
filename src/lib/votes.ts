import { prisma } from "@/lib/prisma";
import { TTLCache } from "@/lib/cache";

export const VOTE_HALF_LIFE_DAYS = 45;
const HALF_LIFE_SECONDS = VOTE_HALF_LIFE_DAYS * 86_400;

export interface VoteAggregate {
  upvotes: number;
  weightedScore: number;
  userVoted: boolean;
}

const voteAggregateCache = new TTLCache<Map<string, Omit<VoteAggregate, "userVoted">>>(
  60_000,
  200,
);

/** Exponential decay weight. Returns 1 at t=0, 0.5 at 45 days, 0.25 at 90 days. */
export function computeDecayWeight(ageMs: number): number {
  if (ageMs <= 0) return 1;
  return Math.pow(0.5, ageMs / 1000 / HALF_LIFE_SECONDS);
}

export async function getAggregates(
  symbols: string[],
): Promise<Map<string, Omit<VoteAggregate, "userVoted">>> {
  if (symbols.length === 0) return new Map();
  const cacheKey = symbols.slice().sort().join(",");
  const cached = voteAggregateCache.get(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<
    Array<{ symbol: string; upvotes: bigint; weighted_score: number }>
  >`
    SELECT
      symbol,
      COUNT(*)::bigint AS upvotes,
      COALESCE(SUM(
        POWER(0.5, EXTRACT(EPOCH FROM (NOW() - "createdAt")) / ${HALF_LIFE_SECONDS})
      ), 0)::float8 AS weighted_score
    FROM "UserVote"
    WHERE symbol = ANY(${symbols}::text[])
    GROUP BY symbol
  `;

  const map = new Map<string, Omit<VoteAggregate, "userVoted">>();
  for (const r of rows) {
    map.set(r.symbol, {
      upvotes: Number(r.upvotes),
      weightedScore: Math.round(r.weighted_score * 10) / 10,
    });
  }
  for (const s of symbols) {
    if (!map.has(s)) map.set(s, { upvotes: 0, weightedScore: 0 });
  }

  voteAggregateCache.set(cacheKey, map);
  return map;
}

export function bustAggregateCache(): void {
  voteAggregateCache.clear();
}

export async function getUserVotes(
  userId: string,
  symbols: string[],
): Promise<Set<string>> {
  if (symbols.length === 0) return new Set();
  const rows = await prisma.userVote.findMany({
    where: { userId, symbol: { in: symbols } },
    select: { symbol: true },
  });
  return new Set(rows.map((r) => r.symbol));
}
