import { promises as fs } from "fs";
import path from "path";
import {
  SignedDataVerifier,
  Environment,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

import type { SubscriptionProvider, SubscriptionStatus } from "@/generated/prisma/client";

export const KNOWN_PRO_PRODUCTS = new Set<string>([
  "com.signalscopes.ios.pro.monthly",
  "com.signalscopes.ios.pro.annual",
]);

export const APPLE_BUNDLE_ID = "com.signalscopes.ios";

const APPLE_APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID
  ? Number(process.env.APPLE_APP_APPLE_ID)
  : 0;

const ROOT_CERTS_DIR = process.env.APPLE_ROOT_CERTS_DIR ||
  path.join(process.cwd(), "certs", "apple");

let cachedCerts: Buffer[] | null = null;
const verifierCache = new Map<Environment, SignedDataVerifier>();

async function loadRootCerts(strict: boolean): Promise<Buffer[]> {
  if (cachedCerts) return cachedCerts;
  // Apple publishes four root certificates used to sign App Store JWS payloads.
  // Drop the .cer files into APPLE_ROOT_CERTS_DIR (defaults to ./certs/apple).
  // Source: https://www.apple.com/certificateauthority/
  const filenames = [
    "AppleIncRootCertificate.cer",
    "AppleRootCA-G2.cer",
    "AppleRootCA-G3.cer",
    "AppleComputerRootCertificate.cer",
  ];
  const buffers: Buffer[] = [];
  const missing: string[] = [];
  for (const name of filenames) {
    const p = path.join(ROOT_CERTS_DIR, name);
    try {
      buffers.push(await fs.readFile(p));
    } catch {
      missing.push(p);
    }
  }
  if (strict && missing.length > 0) {
    throw new Error(
      `Apple root certificate(s) missing: ${missing.join(", ")} (set APPLE_ROOT_CERTS_DIR or place the .cer files there).`
    );
  }
  // Only cache when we have a complete set; otherwise a later strict call
  // could be misled into thinking the cert dir is fully populated.
  if (missing.length === 0) cachedCerts = buffers;
  return buffers;
}

async function getVerifier(env: Environment): Promise<SignedDataVerifier> {
  const cached = verifierCache.get(env);
  if (cached) return cached;
  // Production/Sandbox JWSes are Apple-signed — chain verification requires
  // all four root certs. Xcode/LocalTesting JWSes aren't signed by Apple at
  // all (the SDK explicitly skips chain verification for them) so missing
  // certs are fine in dev.
  const strict = env === Environment.PRODUCTION || env === Environment.SANDBOX;
  const certs = await loadRootCerts(strict);
  const verifier = new SignedDataVerifier(
    certs,
    /* enableOnlineChecks */ false,
    env,
    APPLE_BUNDLE_ID,
    APPLE_APP_APPLE_ID || undefined
  );
  verifierCache.set(env, verifier);
  return verifier;
}

/**
 * Decode the JWS body segment without verifying. Used to pick the right
 * verifier — the SDK throws INVALID_ENVIRONMENT when the constructor's
 * Environment doesn't match the JWS payload's environment claim.
 *
 * The SDK distinguishes four environments:
 *   - Production / Sandbox: real Apple-signed JWSes, full chain verification.
 *   - Xcode / LocalTesting: tokens minted by Xcode's local StoreKit config
 *     during development; the SDK intentionally skips signature verification
 *     for these (they aren't Apple-signed) — see jws_verification.js.
 *
 * In production we ignore the "Xcode" branch (the App Review reviewer never
 * sends Xcode-env tokens; only sandbox testers do).
 */
function peekEnvironment(jws: string): Environment {
  const segments = jws.split(".");
  if (segments.length < 2) return Environment.SANDBOX;
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8")
    ) as { environment?: string };
    switch (payload.environment) {
      case "Production":   return Environment.PRODUCTION;
      case "Xcode":        return Environment.XCODE;
      case "LocalTesting": return Environment.LOCAL_TESTING;
      case "Sandbox":
      default:             return Environment.SANDBOX;
    }
  } catch {
    return Environment.SANDBOX;
  }
}

export async function verifyTransactionJWS(
  signedTransaction: string
): Promise<JWSTransactionDecodedPayload> {
  const env = peekEnvironment(signedTransaction);
  // Xcode/LocalTesting tokens bypass Apple's certificate chain — reject them so an
  // attacker can't self-sign a JWS to claim a free subscription.
  if (env === Environment.XCODE || env === Environment.LOCAL_TESTING) {
    throw new Error(`Environment "${env}" is not accepted by this server.`);
  }
  const verifier = await getVerifier(env);
  const decoded = await verifier.verifyAndDecodeTransaction(signedTransaction);
  if (decoded.bundleId !== APPLE_BUNDLE_ID) {
    throw new Error(`Unexpected bundleId: ${decoded.bundleId}`);
  }
  return decoded;
}

export async function verifyNotificationJWS(
  signedPayload: string
): Promise<ResponseBodyV2DecodedPayload> {
  const env = peekEnvironment(signedPayload);
  if (env === Environment.XCODE || env === Environment.LOCAL_TESTING) {
    throw new Error(`Environment "${env}" is not accepted by this server.`);
  }
  const verifier = await getVerifier(env);
  return verifier.verifyAndDecodeNotification(signedPayload);
}

/**
 * True iff the decoded transaction confers an active entitlement *right now*.
 * Apple guidance: revoked transactions and transactions superseded by an
 * upgrade do not grant entitlement, regardless of expiration date.
 */
export function isTransactionActive(tx: JWSTransactionDecodedPayload, now: Date = new Date()): boolean {
  if (tx.revocationDate) return false;
  if (tx.isUpgraded) return false;
  if (!tx.expiresDate) return false;
  return tx.expiresDate > now.getTime();
}

export interface SubscriptionUpsertData {
  provider: SubscriptionProvider;
  stripeSubscriptionId: null;
  stripePriceId: null;
  appleOriginalTransactionId: string;
  appleProductId: string;
  appleEnvironment: string;
  appleAutoRenewStatus: boolean | null;
  appleExpirationIntent: number | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

/**
 * Build the prisma upsert payload from a decoded Apple transaction.
 * Caller (verify route or webhook) supplies the renewal-info-derived fields
 * (autoRenewStatus, expirationIntent) when available.
 */
export function transactionToUpsertData(
  tx: JWSTransactionDecodedPayload,
  opts: {
    autoRenewStatus?: boolean | null;
    expirationIntent?: number | null;
    revokedNow?: boolean;
  } = {}
): SubscriptionUpsertData {
  const active = isTransactionActive(tx) && !opts.revokedNow;
  const periodStart = tx.purchaseDate ? new Date(tx.purchaseDate) : new Date();
  const periodEnd = tx.expiresDate ? new Date(tx.expiresDate) : new Date();
  const revoked = tx.revocationDate ? new Date(tx.revocationDate) : null;

  return {
    provider: "APPLE",
    // Clear Stripe state when flipping a row to APPLE (avoids stale @unique IDs).
    stripeSubscriptionId: null,
    stripePriceId: null,
    appleOriginalTransactionId: tx.originalTransactionId!,
    appleProductId: tx.productId!,
    appleEnvironment: tx.environment ?? "Sandbox",
    appleAutoRenewStatus: opts.autoRenewStatus ?? null,
    appleExpirationIntent: opts.expirationIntent ?? null,
    status: active ? "ACTIVE" : "CANCELED",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: opts.autoRenewStatus === false,
    canceledAt: revoked ?? (active ? null : new Date()),
  };
}
