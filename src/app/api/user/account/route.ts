import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();

    // Load subscription state BEFORE deleting — we need stripeSubscriptionId
    // to cancel the upstream Stripe subscription, and the row will be
    // cascade-deleted with the User.
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        subscription: {
          select: {
            provider: true,
            status: true,
            stripeSubscriptionId: true,
          },
        },
      },
    });

    const sub = user.subscription;
    const isActive = sub?.status === "ACTIVE" || sub?.status === "PAST_DUE";

    // Stripe: cancel immediately if active (server can do this directly).
    if (sub?.provider === "STRIPE" && isActive && sub.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription during account deletion:", err);
        // Don't block deletion on Stripe failure.
      }
    }

    // Hard-delete the User. All child rows (Subscription, RefreshToken,
    // ApiKey, PasswordResetToken, UserPosition, UserWatchlist, UserVote) have
    // onDelete: Cascade in the schema, so Postgres removes them in the same statement.
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("DELETE /api/user/account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
