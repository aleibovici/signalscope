import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { updatePositionSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    const existing = await prisma.userPosition.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updatePositionSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.closePrice !== undefined) updateData.closePrice = data.closePrice;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.shares !== undefined) updateData.shares = data.shares;
    if (data.status === "CLOSED") updateData.closedAt = new Date();

    const position = await prisma.userPosition.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ position });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("PATCH /api/portfolio/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    const existing = await prisma.userPosition.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    await prisma.userPosition.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("DELETE /api/portfolio/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
