import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { isRateLimited, isApiKeyRateLimited, checkAndIncrementFreeApiKey } from "@/lib/rate-limit";
import { verifyAccessToken } from "@/lib/mobile-jwt";
import { createHash } from "crypto";

const pendingLastUsed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function trackUserActivity(userId: string): void {
  prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    .catch(() => {});
}

function trackApiKeyUsage(id: string) {
  pendingLastUsed.add(id);
  if (pendingLastUsed.size >= 100) {
    flushApiKeyUsage();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushApiKeyUsage, 60_000);
    if (flushTimer.unref) flushTimer.unref();
  }
}

async function flushApiKeyUsage() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pendingLastUsed.size === 0) return;
  const ids = [...pendingLastUsed];
  pendingLastUsed.clear();
  prisma.apiKey.updateMany({
    where: { id: { in: ids } },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 10;

/**
 * Full NextAuth instance with credential verification.
 * This file uses Node.js APIs (Prisma, bcrypt) and must NOT be
 * imported from Edge middleware — use auth.config.ts there instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // Rate limit by email to prevent brute-force attacks
        if (isRateLimited(`login:${email.toLowerCase()}`, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS)) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || user.deletedAt) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

async function assertNotDeleted(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  if (!user || user.deletedAt) throw new Error("Not authenticated");
}

export async function getCurrentUserId(): Promise<string> {
  const headerStore = await headers();

  // 1. Check for mobile Bearer token
  const authHeader = headerStore.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    if (payload?.sub) {
      await assertNotDeleted(payload.sub);
      trackUserActivity(payload.sub);
      return payload.sub;
    }
    throw new Error("Not authenticated");
  }

  // 2. Check for API key
  const apiKey = headerStore.get("x-api-key");
  if (apiKey) {
    const hash = createHash("sha256").update(apiKey).digest("hex");
    const record = await prisma.apiKey.findUnique({
      where: { key: hash },
      include: {
        user: { select: { subscription: { select: { status: true } } } },
      },
    });
    if (record && !record.revokedAt) {
      const subStatus = record.user?.subscription?.status;
      const isPro = subStatus === "ACTIVE" || subStatus === "PAST_DUE";

      if (isPro) {
        if (isApiKeyRateLimited(record.userId)) {
          throw new Error("API key rate limit exceeded (1,000 requests/day)");
        }
      } else {
        const { allowed } = await checkAndIncrementFreeApiKey(record.id);
        if (!allowed) {
          throw new Error(
            "API key rate limit exceeded: free plan allows 10 calls per calendar month. Upgrade to Pro for 1,000/day."
          );
        }
      }

      await assertNotDeleted(record.userId);
      trackApiKeyUsage(record.id);
      trackUserActivity(record.userId);
      return record.userId;
    }
    throw new Error("Not authenticated");
  }

  // 3. Fall back to Auth.js cookie session
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  await assertNotDeleted(session.user.id);
  trackUserActivity(session.user.id);
  return session.user.id;
}

/**
 * Like getCurrentUserId(), but returns null instead of throwing
 * when no authentication is present. Use for routes that serve
 * public data but still want to track logged-in user activity.
 */
export async function getOptionalUserId(): Promise<string | null> {
  try {
    return await getCurrentUserId();
  } catch {
    return null;
  }
}
