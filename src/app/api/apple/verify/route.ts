import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import {
  KNOWN_PRO_PRODUCTS,
  isTransactionActive,
  transactionToUpsertData,
  verifyTransactionJWS,
} from "@/lib/apple-iap";
import { getSubscriptionForApi, hasActiveStripeSub } from "@/lib/subscription";

const bodySchema = z.object({
  signedTransaction: z.string().min(20),
});

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  let decoded: Awaited<ReturnType<typeof verifyTransactionJWS>>;
  try {
    decoded = await verifyTransactionJWS(parsed.data.signedTransaction);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_signature",
        message: err instanceof Error ? err.message : "Could not verify transaction",
      },
      { status: 400 }
    );
  }

  if (!decoded.productId || !KNOWN_PRO_PRODUCTS.has(decoded.productId)) {
    return NextResponse.json(
      { error: "unknown_product", message: `Unknown product: ${decoded.productId}` },
      { status: 400 }
    );
  }

  if (!decoded.originalTransactionId) {
    return NextResponse.json(
      { error: "invalid_transaction", message: "Missing originalTransactionId" },
      { status: 400 }
    );
  }

  // Block if the same Apple originalTransactionId is already linked to a different account.
  const existingByOriginalTx = await prisma.subscription.findUnique({
    where: { appleOriginalTransactionId: decoded.originalTransactionId },
    select: { userId: true },
  });
  if (existingByOriginalTx && existingByOriginalTx.userId !== userId) {
    return NextResponse.json(
      {
        error: "already_linked",
        message:
          "This Apple subscription is already linked to a different SignalScope account. Contact support to resolve.",
      },
      { status: 409 }
    );
  }

  // Block if the user has an active Stripe sub (per product policy).
  // Reject before writing any Apple state — user must cancel the web sub first.
  if (await hasActiveStripeSub(userId)) {
    return NextResponse.json(
      {
        error: "stripe_active",
        message:
          "You already have an active subscription on the web. Cancel it at signalscopes.com before subscribing on iOS.",
      },
      { status: 409 }
    );
  }

  // Reject revoked / superseded transactions outright — the app should not get
  // entitlement, and we shouldn't write a CANCELED row from a verify call.
  if (!isTransactionActive(decoded)) {
    return NextResponse.json(
      {
        error: "transaction_not_active",
        message: "Transaction is revoked, upgraded, or expired.",
      },
      { status: 400 }
    );
  }

  const data = transactionToUpsertData(decoded);

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  const subscription = await getSubscriptionForApi(userId);
  return NextResponse.json({ subscription });
}
