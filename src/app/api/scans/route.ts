import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validators";
import { z } from "zod/v4";

const scansFilterSchema = paginationSchema.extend({
  status: z.enum(["RUNNING", "COMPLETED", "FAILED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { page, limit, status, from, to } = scansFilterSchema.parse(params);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (from || to) {
      where.startedAt = {
        ...(from && { gte: from }),
        ...(to && { lte: new Date(to.getTime() + 86400000) }), // inclusive end of day
      };
    }

    const [scans, total] = await Promise.all([
      prisma.scan.findMany({
        where,
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
        },
      }),
      prisma.scan.count({ where }),
    ]);

    return NextResponse.json({ scans, total, page, limit });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid parameters", details: err.issues }, { status: 400 });
    }
    console.error("[/api/scans] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
