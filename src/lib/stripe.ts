import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
      // Pin to basil API version for coupon/promotion code compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2025-03-31.basil" as any,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — kept for convenience in route handlers */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  yearly: process.env.STRIPE_PRICE_YEARLY!,
} as const;

export type BillingPeriod = keyof typeof PRICE_IDS;
