import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stripe, PRICE_IDS, type BillingPeriod } from "@/lib/stripe";

const checkoutSchema = z.object({
  period: z.enum(["monthly", "yearly"]),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const { period } = checkoutSchema.parse(body);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });

    // Find or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Check for existing active subscription on either platform.
    const existing = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, provider: true },
    });
    if (existing && (existing.status === "ACTIVE" || existing.status === "PAST_DUE")) {
      const msg = existing.provider === "APPLE"
        ? "You already have an active subscription via the iOS app. Manage it in Settings → Apple ID → Subscriptions."
        : "You already have an active subscription. Manage it from the subscription page.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const priceId = PRICE_IDS[period as BillingPeriod];
    const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/subscription?success=1`,
      cancel_url: `${origin}/subscription`,
      metadata: { userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err, "POST /api/stripe/checkout");
  }
}
