import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const { page, limit } = paginationSchema.parse(params);
  const skip = (page - 1) * limit;

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        signalCount: true,
        validatedCount: true,
        filteredCount: true,
        aiCost: true,
      },
    }),
    prisma.scan.count(),
  ]);

  return NextResponse.json({ scans, total, page, limit });
}
