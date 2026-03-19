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

    const [total, byEndpoint, last7dRows, last30dRows, recentPayments] =
      await Promise.all([
        prisma.x402Payment.count(),
        prisma.x402Payment.groupBy({
          by: ["endpoint", "amountUsd"],
          _count: { endpoint: true },
        }),
        prisma.x402Payment.findMany({
          where: { createdAt: { gte: ago7d } },
          select: { amountUsd: true },
        }),
        prisma.x402Payment.findMany({
          where: { createdAt: { gte: ago30d } },
          select: { amountUsd: true },
        }),
        prisma.x402Payment.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            endpoint: true,
            amountUsd: true,
            payerAddress: true,
            createdAt: true,
          },
        }),
      ]);

    const sumAmounts = (rows: { amountUsd: string }[]) =>
      rows.reduce((acc, r) => acc + parseFloat(r.amountUsd), 0);

    const allPayments = await prisma.x402Payment.findMany({
      select: { amountUsd: true },
    });
    const allTimeRevenue = sumAmounts(allPayments);

    const endpointStats = byEndpoint.map((r) => ({
      endpoint: r.endpoint,
      count: r._count.endpoint,
      amountUsd: r.amountUsd,
      revenue: r._count.endpoint * parseFloat(r.amountUsd),
    }));

    return NextResponse.json({
      total,
      allTimeRevenue,
      last7d: {
        count: last7dRows.length,
        revenue: sumAmounts(last7dRows),
      },
      last30d: {
        count: last30dRows.length,
        revenue: sumAmounts(last30dRows),
      },
      byEndpoint: endpointStats,
      recentPayments: recentPayments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err, "/api/admin/payments GET");
  }
}
