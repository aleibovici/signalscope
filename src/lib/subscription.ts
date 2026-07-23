import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionStatus } from "@/generated/prisma/client";
import { absoluteUrl } from "@/lib/site-url";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE"];

/** True when Stripe billing is configured (optional self-host feature). */
export function isSubscriptionsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

const STRIPE_PORTAL_URL = absoluteUrl("/api/stripe/portal");

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
  if (!isSubscriptionsEnabled()) return true;

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

  const productId = sub.stripePriceId ?? sub.appleProductId;
  const managementUrl = sub.provider === "STRIPE" ? STRIPE_PORTAL_URL : null;

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
