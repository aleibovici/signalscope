import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple in-memory rate limiter (for single-instance deployments).
// Shared across login and registration endpoints.

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ENTRIES = 10_000;

export function getClientIP(request: NextRequest): string {
  // Behind a reverse proxy or load balancer each hop appends to X-Forwarded-For.
  // The rightmost entry is the proxy; the second-to-last is the real client IP.
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",").map((s) => s.trim());
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  }

  const xRealIP = request.headers.get("x-real-ip");
  if (xRealIP) {
    return xRealIP.trim();
  }

  return "unknown";
}

/**
 * Check if an IP is rate-limited for a given action.
 * @param key - Unique key combining IP and action (e.g. "login:1.2.3.4")
 * @param windowMs - Time window in milliseconds
 * @param maxAttempts - Max attempts within the window
 */
export function isRateLimited(
  key: string,
  windowMs: number,
  maxAttempts: number
): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  // Periodically purge expired entries to prevent unbounded memory growth
  if (attempts.size > MAX_ENTRIES) {
    for (const [k, val] of attempts) {
      if (now > val.resetAt) attempts.delete(k);
    }
  }

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > maxAttempts;
}

/** 24-hour window for API key rate limiting */
const API_KEY_WINDOW_MS = 24 * 60 * 60 * 1000;
const API_KEY_DAILY_LIMIT = 1000;

/**
 * Check if an API key user has exceeded their daily rate limit.
 * @returns true if rate-limited
 */
export function isApiKeyRateLimited(userId: string): boolean {
  return isRateLimited(`apikey:${userId}`, API_KEY_WINDOW_MS, API_KEY_DAILY_LIMIT);
}

/** Monthly call limit for free-tier API keys */
export const FREE_MONTHLY_LIMIT = 10;

function firstDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Atomically check and increment the monthly call count for a free-tier API key.
 * Resets the window on the 1st of the UTC calendar month.
 * NOTE: Atomicity relies on Postgres row-level locking (READ COMMITTED / EvalPlanQual).
 * Do NOT refactor to a read-then-write pattern.
 * @returns { allowed: true } if under limit (count incremented), { allowed: false } if limit reached
 */
export async function checkAndIncrementFreeApiKey(
  apiKeyId: string
): Promise<{ allowed: boolean }> {
  const thisMonth = firstDayOfMonth(new Date());

  // Step 1: reset window if it's from a prior month
  await prisma.apiKey.updateMany({
    where: { id: apiKeyId, monthlyWindowStart: { lt: thisMonth } },
    data: { monthlyCallCount: 0, monthlyWindowStart: thisMonth },
  });

  // Step 2: increment only if under limit (atomic gate)
  const result = await prisma.apiKey.updateMany({
    where: { id: apiKeyId, monthlyCallCount: { lt: FREE_MONTHLY_LIMIT } },
    data: { monthlyCallCount: { increment: 1 } },
  });

  return { allowed: result.count > 0 };
}
