import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionStatus } from "@/generated/prisma/client";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE"];

const STRIPE_PORTAL_URL = "https://signalscopes.com/api/stripe/portal";
const APPLE_MANAGE_URL = "https://apps.apple.com/account/subscriptions";

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

/** Active subscription that originated on the web (Stripe). */
export async function hasActiveStripeSub(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, provider: true },
  });
  return sub !== null
    && sub.provider === "STRIPE"
    && ACTIVE_STATUSES.includes(sub.status);
}

export async function getSubscriptionForApi(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      provider: true,
      status: true,
      stripePriceId: true,
      appleProductId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      createdAt: true,
    },
  });
  if (!sub) return null;

  const productId = sub.provider === "APPLE" ? sub.appleProductId : sub.stripePriceId;
  const managementUrl = sub.provider === "APPLE" ? APPLE_MANAGE_URL : STRIPE_PORTAL_URL;

  return {
    provider: sub.provider,
    status: sub.status,
    isActive: ACTIVE_STATUSES.includes(sub.status),
    productId,
    managementUrl,
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
  };
}

/** Daily API key rate limit for subscribers */
export const API_KEY_DAILY_LIMIT = 1000;
