import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIP, isRateLimited } from "@/lib/rate-limit";
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/mobile-jwt";

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const REFRESH_WINDOW_MS = 15 * 60 * 1000;
const REFRESH_MAX_ATTEMPTS = 30;

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    if (isRateLimited(`mobile-refresh:${clientIP}`, REFRESH_WINDOW_MS, REFRESH_MAX_ATTEMPTS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { refreshToken: tokenValue } = parsed.data;

    const existing = await prisma.refreshToken.findUnique({
      where: { token: tokenValue },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    // Token rotation: revoke old token and issue new pair
    const newRefreshTokenValue = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshTokenValue,
          userId: existing.userId,
          expiresAt: getRefreshTokenExpiry(),
          deviceId: existing.deviceId,
        },
      }),
    ]);

    const accessToken = await signAccessToken({
      sub: existing.user.id,
      email: existing.user.email,
      role: existing.user.role,
    });

    return NextResponse.json({
      accessToken,
      refreshToken: newRefreshTokenValue,
      expiresIn: 900,
    });
  } catch (error) {
    console.error("POST /api/auth/refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
