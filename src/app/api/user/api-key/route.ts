import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId, revokedAt: null },
      select: { prefix: true, createdAt: true, lastUsedAt: true },
    });
    return NextResponse.json({ apiKey });
  } catch (err) {
    return handleApiError(err, "GET /api/user/api-key");
  }
}

export async function POST() {
  try {
    const userId = await getCurrentUserId();

    // Revoke any existing key
    await prisma.apiKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Generate new key
    const raw = `sk_sig_${randomBytes(24).toString("hex")}`;
    const hash = createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 12) + "...";

    await prisma.apiKey.create({
      data: { key: hash, prefix, userId },
    });

    return NextResponse.json({
      key: raw,
      prefix,
      skill: "https://signalscopes.com/skill/SKILL.md",
    });
  } catch (err) {
    return handleApiError(err, "POST /api/user/api-key");
  }
}

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();
    await prisma.apiKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "DELETE /api/user/api-key");
  }
}
