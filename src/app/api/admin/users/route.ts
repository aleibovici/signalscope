import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailAlerts: true,
        createdAt: true,
        lastActiveAt: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
        _count: {
          select: {
            positions: true,
            watchlist: true,
            apiKeys: true,
          },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err, "/api/admin/users GET");
  }
}
