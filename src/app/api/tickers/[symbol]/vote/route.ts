import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { symbolSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-error";
import { getAggregates, bustAggregateCache } from "@/lib/votes";

type RouteContext = { params: Promise<{ symbol: string }> };

async function resolveSymbol(params: RouteContext["params"]): Promise<string> {
  const { symbol } = await params;
  return symbolSchema.parse(symbol);
}

async function aggregateResponse(symbol: string, userId: string) {
  const agg = await getAggregates([symbol]);
  const entry = agg.get(symbol) ?? { upvotes: 0, weightedScore: 0 };
  const voted = await prisma.userVote.findUnique({
    where: { userId_symbol: { userId, symbol } },
    select: { id: true },
  });
  return NextResponse.json({ ...entry, userVoted: !!voted });
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const symbol = await resolveSymbol(params);
    const userId = await getCurrentUserId();

    await prisma.userVote.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol },
      update: {},
    });

    bustAggregateCache();
    return aggregateResponse(symbol, userId);
  } catch (error) {
    return handleApiError(error, "/api/tickers/[symbol]/vote POST");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const symbol = await resolveSymbol(params);
    const userId = await getCurrentUserId();

    await prisma.userVote.deleteMany({ where: { userId, symbol } });

    bustAggregateCache();
    return aggregateResponse(symbol, userId);
  } catch (error) {
    return handleApiError(error, "/api/tickers/[symbol]/vote DELETE");
  }
}
