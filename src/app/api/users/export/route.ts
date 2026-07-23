import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// GET /api/users/export
// Returns all users with emailAlerts=true (non-deleted).
// Auth: x-snapshot-key header.
// Format: JSON (default) or CSV via ?format=csv
//
// JSON shape:
//   { users: [{ email, name, tier, createdAt }], total: number }
//
// CSV shape (Mailchimp-compatible):
//   Email Address,First Name,Last Name,TIER,MEMBER_SINCE
export async function GET(req: NextRequest) {
  try {
    const snapshotKey = req.headers.get("x-snapshot-key");
    const expectedKey = process.env.SNAPSHOT_API_KEY;

    if (!expectedKey) {
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }
    if (!snapshotKey || snapshotKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: { emailAlerts: true, deletedAt: null },
      select: {
        email: true,
        name: true,
        createdAt: true,
        subscription: { select: { status: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const ACTIVE = ["ACTIVE", "PAST_DUE"];

    const rows = users.map((u) => {
      const tier = u.subscription && ACTIVE.includes(u.subscription.status) ? "pro" : "free";
      const [firstName, ...rest] = (u.name ?? "").trim().split(" ");
      return {
        email: u.email,
        name: u.name ?? "",
        firstName: firstName ?? "",
        lastName: rest.join(" "),
        tier,
        createdAt: u.createdAt.toISOString().slice(0, 10),
      };
    });

    const format = req.nextUrl.searchParams.get("format");

    if (format === "csv") {
      const header = "Email Address,First Name,Last Name,TIER,MEMBER_SINCE";
      const lines = rows.map(
        (r) =>
          [r.email, r.firstName, r.lastName, r.tier, r.createdAt]
            .map((v) => `"${v.replace(/"/g, '""')}"`)
            .join(",")
      );
      const csv = [header, ...lines].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="signalscope-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      users: rows.map(({ firstName, lastName, ...r }) => r),
      total: rows.length,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/users/export");
  }
}
