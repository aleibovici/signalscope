import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUsername } from "@/lib/username-generator";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
  name: z.string().min(1).max(100).optional(),
});

// Simple in-memory rate limit (for single-instance deployments)
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES = 10_000;

function getClientIP(request: NextRequest): string {
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

  // Fallback - NextRequest doesn't expose raw IP, use a placeholder
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  // Periodically purge expired entries to prevent unbounded memory growth
  if (attempts.size > MAX_ENTRIES) {
    for (const [key, val] of attempts) {
      if (now > val.resetAt) attempts.delete(key);
    }
  }

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(request);
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // Check if email exists BEFORE hashing password to prevent timing oracle
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Always hash password to maintain consistent timing regardless of email status
    const passwordHash = await bcrypt.hash(password, 12);

    if (existingUser) {
      return NextResponse.json(
        { error: "Registration failed. Please try a different email or contact support." },
        { status: 400 }
      );
    }

    let user;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        user = await prisma.user.create({
          data: { email, passwordHash, name, username: generateUsername() },
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < 4
        ) {
          // Username collision — retry with a new one
          continue;
        }
        throw err;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, username: user.username } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Registration failed. Please try a different email or contact support." },
        { status: 400 }
      );
    }
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
