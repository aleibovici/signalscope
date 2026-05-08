import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isTransactionActive,
  transactionToUpsertData,
  verifyNotificationJWS,
} from "@/lib/apple-iap";
import {
  NotificationTypeV2,
  type JWSTransactionDecodedPayload,
  type JWSRenewalInfoDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

export async function POST(request: NextRequest) {
  let signedPayload: string;
  try {
    const body = (await request.json()) as { signedPayload?: unknown };
    if (typeof body.signedPayload !== "string") {
      return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 });
    }
    signedPayload = body.signedPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let decoded: ResponseBodyV2DecodedPayload;
  try {
    decoded = await verifyNotificationJWS(signedPayload);
  } catch (err) {
    console.error("Apple webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Apple expects 200 OK for any signature-valid receipt; non-2xx triggers retries.
  try {
    await handleNotification(decoded);
  } catch (err) {
    console.error("Apple webhook handler error:", err, "type:", decoded.notificationType);
  }

  return NextResponse.json({ received: true });
}

async function handleNotification(notif: ResponseBodyV2DecodedPayload): Promise<void> {
  if (!notif.data) return;

  const tx = notif.data.signedTransactionInfo as
    | JWSTransactionDecodedPayload
    | undefined;
  const renewal = notif.data.signedRenewalInfo as
    | JWSRenewalInfoDecodedPayload
    | undefined;

  if (!tx) return;

  const originalTx = tx.originalTransactionId;
  if (!originalTx) return;

  // Find the existing subscription row by Apple's original transaction ID.
  // If it doesn't exist, this is a renewal for a transaction we never saw via
  // /api/apple/verify (rare — usually means the verify call failed and the
  // app retried). Skip; we can't link to a userId without the verify call.
  const existing = await prisma.subscription.findUnique({
    where: { appleOriginalTransactionId: originalTx },
    select: { userId: true },
  });
  if (!existing) {
    console.warn(
      "Apple webhook: no subscription row for originalTransactionId",
      originalTx,
      "type:",
      notif.notificationType
    );
    return;
  }

  const opts = {
    autoRenewStatus: renewal?.autoRenewStatus === undefined
      ? null
      : renewal.autoRenewStatus === 1,
    expirationIntent: renewal?.expirationIntent ?? null,
    revokedNow: false,
  };

  switch (notif.notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
    case NotificationTypeV2.RENEWAL_EXTENDED:
    case NotificationTypeV2.PRICE_INCREASE:
    case NotificationTypeV2.OFFER_REDEEMED: {
      const data = transactionToUpsertData(tx, opts);
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data,
      });
      break;
    }

    case NotificationTypeV2.DID_FAIL_TO_RENEW: {
      const data = transactionToUpsertData(tx, opts);
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { ...data, status: isTransactionActive(tx) ? "PAST_DUE" : data.status },
      });
      break;
    }

    case NotificationTypeV2.GRACE_PERIOD_EXPIRED: {
      const data = transactionToUpsertData(tx, opts);
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { ...data, status: "UNPAID" },
      });
      break;
    }

    case NotificationTypeV2.EXPIRED: {
      const data = transactionToUpsertData(tx, opts);
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { ...data, status: "CANCELED", canceledAt: new Date() },
      });
      break;
    }

    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.REVOKE: {
      const data = transactionToUpsertData(tx, { ...opts, revokedNow: true });
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { ...data, status: "CANCELED", canceledAt: new Date() },
      });
      break;
    }

    case NotificationTypeV2.REFUND_DECLINED:
    case NotificationTypeV2.REFUND_REVERSED:
    case NotificationTypeV2.CONSUMPTION_REQUEST:
    case NotificationTypeV2.EXTERNAL_PURCHASE_TOKEN:
    case NotificationTypeV2.ONE_TIME_CHARGE:
    case NotificationTypeV2.TEST: {
      // No DB change required.
      break;
    }

    default:
      console.warn("Apple webhook: unhandled notificationType", notif.notificationType);
  }
}
