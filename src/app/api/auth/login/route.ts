import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/mobile-jwt";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().max(255).optional(),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS_IP = 20;
const LOGIN_MAX_ATTEMPTS_EMAIL = 10;

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    if (isRateLimited(`mobile-login:${clientIP}`, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS_IP)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, deviceId } = parsed.data;

    if (isRateLimited(`mobile-login:${email.toLowerCase()}`, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS_EMAIL)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || user.deletedAt) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    const refreshTokenHash = createHash("sha256").update(refreshTokenValue).digest("hex");
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
        deviceId: deviceId ?? null,
      },
    });

    return NextResponse.json({
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        emailAlerts: user.emailAlerts,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
