import { NextRequest, NextResponse } from "next/server";
import { symbolsQuerySchema } from "@/lib/validators";
import { getOptionalUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { getAggregates, getUserVotes, VoteAggregate } from "@/lib/votes";

export async function GET(request: NextRequest) {
  try {
    const userId = await getOptionalUserId();
    const symbolsParam = request.nextUrl.searchParams.get("symbols");
    if (!symbolsParam) {
      return NextResponse.json({ error: "symbols query param required" }, { status: 400 });
    }

    const symbols = symbolsQuerySchema.parse(symbolsParam);
    const aggregates = await getAggregates(symbols);
    const votedSet = userId ? await getUserVotes(userId, symbols) : new Set<string>();

    const votes: Record<string, VoteAggregate> = {};
    for (const symbol of symbols) {
      const agg = aggregates.get(symbol) ?? { upvotes: 0, weightedScore: 0 };
      votes[symbol] = { ...agg, userVoted: votedSet.has(symbol) };
    }

    return NextResponse.json({ votes }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    return handleApiError(error, "/api/votes GET");
  }
}
