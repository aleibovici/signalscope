import { NextRequest } from "next/server";

// Simple in-memory rate limiter (for single-instance deployments).
// Shared across login and registration endpoints.

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ENTRIES = 10_000;

export function getClientIP(request: NextRequest): string {
  // On Cloud Run / reverse proxies, each hop appends to X-Forwarded-For.
  // The rightmost entry is the load balancer; the second-to-last is the real client IP.
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
