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

    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      allTime,
      last24h,
      last7d,
      last30d,
      byAction,
      byEndpoint,
      dailyBreakdown,
    ] = await Promise.all([
      prisma.xApiLog.aggregate({ _sum: { count: true }, _count: true }),

      prisma.xApiLog.aggregate({
        where: { createdAt: { gte: ago24h } },
        _sum: { count: true },
        _count: true,
      }),

      prisma.xApiLog.aggregate({
        where: { createdAt: { gte: ago7d } },
        _sum: { count: true },
        _count: true,
      }),

      prisma.xApiLog.aggregate({
        where: { createdAt: { gte: ago30d } },
        _sum: { count: true },
        _count: true,
      }),

      prisma.xApiLog.groupBy({
        by: ["action"],
        _sum: { count: true },
        _count: true,
        orderBy: { _sum: { count: "desc" } },
      }),

      prisma.xApiLog.groupBy({
        by: ["endpoint", "method"],
        _sum: { count: true },
        _count: true,
        orderBy: { _sum: { count: "desc" } },
      }),

      // Daily totals for last 7 days
      prisma.xApiLog.groupBy({
        by: ["action"],
        where: { createdAt: { gte: ago7d } },
        _sum: { count: true },
        _count: true,
      }),
    ]);

    // Recent log entries
    const recentLogs = await prisma.xApiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Error rate (non-2xx)
    const errors = await prisma.xApiLog.count({
      where: {
        createdAt: { gte: ago7d },
        statusCode: { notIn: [200, 201] },
        NOT: { statusCode: null },
      },
    });

    return NextResponse.json({
      totals: {
        allTime: { calls: allTime._sum.count ?? 0, rows: allTime._count },
        last24h: { calls: last24h._sum.count ?? 0, rows: last24h._count },
        last7d: { calls: last7d._sum.count ?? 0, rows: last7d._count },
        last30d: { calls: last30d._sum.count ?? 0, rows: last30d._count },
      },
      byAction: byAction.map((r) => ({
        action: r.action,
        calls: r._sum.count ?? 0,
        rows: r._count,
      })),
      byEndpoint: byEndpoint.map((r) => ({
        endpoint: `${r.method} ${r.endpoint}`,
        calls: r._sum.count ?? 0,
        rows: r._count,
      })),
      errors7d: errors,
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        endpoint: l.endpoint,
        method: l.method,
        action: l.action,
        count: l.count,
        statusCode: l.statusCode,
      })),
    });
  } catch (err) {
    return handleApiError(err, "/api/admin/x-usage GET");
  }
}
