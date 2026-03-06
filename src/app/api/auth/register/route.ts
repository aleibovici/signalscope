import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUsername } from "@/lib/username-generator";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/mobile-jwt";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
  name: z.string().min(1).max(100).optional(),
  deviceId: z.string().max(255).optional(),
});

const REGISTER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REGISTER_MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(request);
    if (isRateLimited(`register:${clientIP}`, REGISTER_WINDOW_MS, REGISTER_MAX_ATTEMPTS)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name, deviceId } = parsed.data;

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

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
        deviceId: deviceId ?? null,
      },
    });

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role, emailAlerts: user.emailAlerts },
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
      },
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
