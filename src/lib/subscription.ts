import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionStatus } from "@/generated/prisma/client";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE"];

export async function getUserSubscription(
  userId: string
): Promise<Subscription | null> {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

export async function hasActiveSubscription(
  userId: string
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  return sub !== null && ACTIVE_STATUSES.includes(sub.status);
}

export async function getSubscriptionForApi(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      stripePriceId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      createdAt: true,
    },
  });
  if (!sub) return null;
  return {
    status: sub.status,
    isActive: ACTIVE_STATUSES.includes(sub.status),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
  };
}

/** Daily API key rate limit for subscribers */
export const API_KEY_DAILY_LIMIT = 1000;
