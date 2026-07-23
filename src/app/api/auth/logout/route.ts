import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const logoutSchema = z.object({
  deviceId: z.string().max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let deviceId: string | undefined;
    try {
      const body = await request.json();
      const parsed = logoutSchema.safeParse(body);
      if (parsed.success) {
        deviceId = parsed.data.deviceId;
      }
    } catch {
      // Empty body is fine — revoke all tokens
    }

    const where: { userId: string; revokedAt: null; deviceId?: string } = {
      userId,
      revokedAt: null,
    };
    if (deviceId) {
      where.deviceId = deviceId;
    }

    await prisma.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
