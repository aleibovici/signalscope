import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { stageLabel } from "@/lib/stage-labels";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    // Verify admin role
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
      totalUsers,
      newUsers7d,
      newUsers30d,
      emailAlertsUsers,
      usersWithApiKey,
      completedScans,
      failedScans,
      lastScan,
      aiCostTotal,
      totalTickers,
      tickersByStage,
      pndFlaggedCount,
      totalSignals,
      signalsBySource,
      openPositions,
      closedPositions,
      watchlistEntries,
      activeSessions,
      activeApiKeys,
      activeSubscriptions,
      churned,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.user.count({ where: { createdAt: { gte: ago30d } } }),
      prisma.user.count({ where: { emailAlerts: true } }),
      prisma.user.count({ where: { apiKeys: { some: { revokedAt: null } } } }),

      prisma.scan.count({ where: { status: "COMPLETED" } }),
      prisma.scan.count({ where: { status: "FAILED" } }),
      prisma.scan.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, validatedCount: true, signalCount: true },
      }),
      prisma.scan
        .aggregate({ _sum: { aiCost: true } })
        .then((r) => r._sum.aiCost ?? 0),

      prisma.validatedTicker.count(),
      prisma.validatedTicker.groupBy({
        by: ["stage"],
        _count: { stage: true },
      }),
      prisma.validatedTicker.count({ where: { pndFlagged: true } }),

      prisma.signal.count(),
      prisma.signal.groupBy({
        by: ["source"],
        _count: { source: true },
      }),

      prisma.userPosition.count({ where: { status: "OPEN" } }),
      prisma.userPosition.count({ where: { status: "CLOSED" } }),
      prisma.userWatchlist.count(),

      prisma.refreshToken.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      prisma.apiKey.count({ where: { revokedAt: null } }),

      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: { in: ["CANCELED", "UNPAID"] } } }),
    ]);

    const stageMap = Object.fromEntries(
      tickersByStage.map((r) => [stageLabel(r.stage), r._count.stage])
    );
    const sourceMap = Object.fromEntries(
      signalsBySource.map((r) => [r.source, r._count.source])
    );

    return NextResponse.json({
      users: {
        total: totalUsers,
        new7d: newUsers7d,
        new30d: newUsers30d,
        emailAlerts: emailAlertsUsers,
        withApiKey: usersWithApiKey,
        proSubscribers: activeSubscriptions,
        churned,
      },
      scans: {
        completed: completedScans,
        failed: failedScans,
        lastScan: lastScan
          ? {
              startedAt: lastScan.startedAt,
              validatedCount: lastScan.validatedCount,
              signalCount: lastScan.signalCount,
            }
          : null,
        totalAiCost: Number(aiCostTotal),
      },
      tickers: {
        total: totalTickers,
        byStage: stageMap,
        pndFlagged: pndFlaggedCount,
      },
      signals: {
        total: totalSignals,
        bySource: sourceMap,
      },
      engagement: {
        openPositions,
        closedPositions,
        watchlistEntries,
      },
      system: {
        activeSessions,
        activeApiKeys,
      },
    });
  } catch (err) {
    return handleApiError(err, "/api/admin/stats GET");
  }
}
