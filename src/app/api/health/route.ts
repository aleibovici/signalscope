import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs: number | null = null;
  let dbError: string | undefined;

  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - start);
  } catch (err) {
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : "Unknown database error";
  }

  const healthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp,
      version: "0.1.0",
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbError && { error: dbError }),
        },
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
