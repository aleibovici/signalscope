import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  buildTweetIntentUrl,
  claimShareReward,
  ClaimError,
} from "@/lib/share-reward";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { shareRewardClaimedAt: true },
    });

    const isActive = await hasActiveSubscription(userId);

    return NextResponse.json({
      claimed: user.shareRewardClaimedAt !== null,
      claimedAt: user.shareRewardClaimedAt?.toISOString() ?? null,
      tweetIntentUrl: buildTweetIntentUrl(),
      hasActiveSubscription: isActive,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/user/share-reward");
  }
}

const claimSchema = z.object({
  tweetUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!process.env.X_BEARER_TOKEN) {
      return NextResponse.json(
        { error: "Share reward is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid tweet URL." },
        { status: 400 }
      );
    }

    const { rewardType } = await claimShareReward(userId, parsed.data.tweetUrl);

    return NextResponse.json({ success: true, rewardType });
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err, "POST /api/user/share-reward");
  }
}
