import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();

    // Load user with subscription to check for active Stripe sub
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        stripeCustomerId: true,
        subscription: { select: { stripeSubscriptionId: true, status: true } },
      },
    });

    // Cancel Stripe subscription immediately if active
    if (
      user.subscription?.stripeSubscriptionId &&
      (user.subscription.status === "ACTIVE" || user.subscription.status === "PAST_DUE")
    ) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription during account deletion:", err);
        // Continue with deletion — don't block on Stripe failure
      }
    }

    // Soft-delete: anonymize PII, revoke all tokens/keys
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.local`,
          passwordHash: null,
          name: null,
          username: null,
          stripeCustomerId: null,
          emailAlerts: false,
        },
      }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.apiKey.deleteMany({ where: { userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("DELETE /api/user/account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
