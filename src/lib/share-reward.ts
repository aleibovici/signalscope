import { prisma } from "@/lib/prisma";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { hasActiveSubscription } from "@/lib/subscription";

export const SHARE_REWARD_TRIAL_DAYS = 30;
export const SHARE_REWARD_CREDIT_CENTS = 1000; // $10

/* ------------------------------------------------------------------ */
/*  Tweet intent                                                       */
/* ------------------------------------------------------------------ */

const TWEET_TEXT = `I use @signalscopes to spot breakout stocks before the crowd — AI scoring, pump & dump filtering, 8 signal sources.

Free dashboard + weekly digest: http://localhost:3000

#SignalScope #stocks #trading`;

export function buildTweetIntentUrl(): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`;
}

/* ------------------------------------------------------------------ */
/*  Tweet verification                                                 */
/* ------------------------------------------------------------------ */

const TWEET_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;

export function extractTweetId(url: string): string | null {
  const match = url.match(TWEET_URL_RE);
  return match ? match[1] : null;
}

export async function verifyTweet(tweetId: string): Promise<boolean> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) throw new Error("X_BEARER_TOKEN not configured");

  const res = await fetch(
    `https://api.x.com/2/tweets/${tweetId}?tweet.fields=text`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) return false;

  const json = await res.json();
  const text: string = json.data?.text ?? "";
  return /signalscope/i.test(text);
}

/* ------------------------------------------------------------------ */
/*  Reward logic                                                       */
/* ------------------------------------------------------------------ */

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function grantTrialSubscription(userId: string): Promise<void> {
  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripe();

  const trialEnd = Math.floor(Date.now() / 1000) + SHARE_REWARD_TRIAL_DAYS * 24 * 60 * 60;

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: PRICE_IDS.monthly }],
    trial_end: trialEnd,
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
    metadata: { userId, source: "share_reward" },
  });

  const item = subscription.items.data[0];
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item.price.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: item.price.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });
}

async function grantBalanceCredit(userId: string): Promise<void> {
  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripe();

  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -SHARE_REWARD_CREDIT_CENTS,
    currency: "usd",
    description: "Share reward: 1 month Pro credit",
  });
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

export type RewardType = "trial" | "credit";

export async function claimShareReward(
  userId: string,
  tweetUrl: string
): Promise<{ rewardType: RewardType }> {
  // 1. Check one-time gate
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { shareRewardClaimedAt: true },
  });
  if (user.shareRewardClaimedAt) {
    throw new ClaimError("Reward already claimed", 400);
  }

  // 2. Extract + verify tweet
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    throw new ClaimError("Invalid tweet URL. Please paste a link like https://x.com/you/status/123", 400);
  }

  const valid = await verifyTweet(tweetId);
  if (!valid) {
    throw new ClaimError("Tweet not found or doesn't mention SignalScope. Please check the URL and try again.", 400);
  }

  // 3. Apply reward
  const isSubscriber = await hasActiveSubscription(userId);
  const rewardType: RewardType = isSubscriber ? "credit" : "trial";

  if (rewardType === "credit") {
    await grantBalanceCredit(userId);
  } else {
    await grantTrialSubscription(userId);
  }

  // 4. Mark as claimed
  await prisma.user.update({
    where: { id: userId },
    data: { shareRewardClaimedAt: new Date() },
  });

  return { rewardType };
}

export class ClaimError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ClaimError";
  }
}
