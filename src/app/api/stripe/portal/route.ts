import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stripe } from "@/lib/stripe";

export async function POST(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No subscription found. Subscribe first." },
        { status: 400 }
      );
    }

    const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err, "POST /api/stripe/portal");
  }
}
