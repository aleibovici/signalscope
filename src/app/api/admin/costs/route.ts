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
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      allTimeLogs,
      last7dLogs,
      last30dLogs,
      byCallPoint,
      byTrigger,
      recentScanLogs,
      onDemandLogs,
    ] = await Promise.all([
      // All-time total
      prisma.aiCostLog.aggregate({ _sum: { cost: true, inputTokens: true, outputTokens: true }, _count: true }),

      // Last 7 days
      prisma.aiCostLog.aggregate({
        where: { createdAt: { gte: ago7d } },
        _sum: { cost: true },
        _count: true,
      }),

      // Last 30 days
      prisma.aiCostLog.aggregate({
        where: { createdAt: { gte: ago30d } },
        _sum: { cost: true },
        _count: true,
      }),

      // By call point (all time)
      prisma.aiCostLog.groupBy({
        by: ["callPoint"],
        _sum: { cost: true },
        _count: true,
        orderBy: { _sum: { cost: "desc" } },
      }),

      // By trigger (all time)
      prisma.aiCostLog.groupBy({
        by: ["trigger"],
        _sum: { cost: true },
        _count: true,
        orderBy: { _sum: { cost: "desc" } },
      }),

      // Per-scan breakdown (last 30 scans)
      prisma.aiCostLog.groupBy({
        by: ["scanId", "callPoint"],
        where: { scanId: { not: null }, createdAt: { gte: ago30d } },
        _sum: { cost: true },
        _count: true,
      }),

      // On-demand report costs by user (last 30 days)
      prisma.aiCostLog.groupBy({
        by: ["userId"],
        where: { trigger: "on-demand", userId: { not: null }, createdAt: { gte: ago30d } },
        _sum: { cost: true },
        _count: true,
        orderBy: { _sum: { cost: "desc" } },
        take: 20,
      }),
    ]);

    // Enrich on-demand log user IDs with emails
    const onDemandUserIds = onDemandLogs.map((r) => r.userId).filter(Boolean) as string[];
    const users = onDemandUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: onDemandUserIds } },
          select: { id: true, email: true },
        })
      : [];
    const userEmailMap = new Map(users.map((u) => [u.id, u.email]));

    // Enrich scan IDs with scan start dates
    const scanIds = [...new Set(recentScanLogs.map((r) => r.scanId).filter(Boolean) as string[])];
    const scans = scanIds.length
      ? await prisma.scan.findMany({
          where: { id: { in: scanIds } },
          select: { id: true, startedAt: true },
          orderBy: { startedAt: "desc" },
        })
      : [];
    const scanDateMap = new Map(scans.map((s) => [s.id, s.startedAt]));

    // Pivot scan logs: scanId → { callPoint → cost }
    const scanCostMap = new Map<string, { scoring: number; pnd: number; report: number; total: number; startedAt: string }>();
    for (const row of recentScanLogs) {
      if (!row.scanId) continue;
      const existing = scanCostMap.get(row.scanId) ?? {
        scoring: 0,
        pnd: 0,
        report: 0,
        total: 0,
        startedAt: scanDateMap.get(row.scanId)?.toISOString() ?? "",
      };
      const cost = row._sum.cost ?? 0;
      if (row.callPoint === "scoring") existing.scoring += cost;
      else if (row.callPoint === "pnd") existing.pnd += cost;
      else if (row.callPoint === "report") existing.report += cost;
      existing.total += cost;
      scanCostMap.set(row.scanId, existing);
    }

    const recentScans = [...scanCostMap.entries()]
      .map(([scanId, data]) => ({ scanId, ...data }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 20);

    return NextResponse.json({
      totals: {
        allTime: {
          cost: allTimeLogs._sum.cost ?? 0,
          calls: allTimeLogs._count,
          inputTokens: allTimeLogs._sum.inputTokens ?? 0,
          outputTokens: allTimeLogs._sum.outputTokens ?? 0,
        },
        last7d: { cost: last7dLogs._sum.cost ?? 0, calls: last7dLogs._count },
        last30d: { cost: last30dLogs._sum.cost ?? 0, calls: last30dLogs._count },
      },
      byCallPoint: byCallPoint.map((r) => ({
        callPoint: r.callPoint,
        cost: r._sum.cost ?? 0,
        calls: r._count,
      })),
      byTrigger: byTrigger.map((r) => ({
        trigger: r.trigger,
        cost: r._sum.cost ?? 0,
        calls: r._count,
      })),
      recentScans,
      onDemandByUser: onDemandLogs.map((r) => ({
        userId: r.userId,
        email: r.userId ? (userEmailMap.get(r.userId) ?? "—") : "—",
        calls: r._count,
        cost: r._sum.cost ?? 0,
      })),
    });
  } catch (err) {
    return handleApiError(err, "/api/admin/costs GET");
  }
}
