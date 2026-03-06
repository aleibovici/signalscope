import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { updatePositionSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    const body = await request.json();
    const data = updatePositionSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.closePrice !== undefined) updateData.closePrice = data.closePrice;
    if (data.entryPrice !== undefined) updateData.entryPrice = data.entryPrice;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.shares !== undefined) updateData.shares = data.shares;
    if (data.status === "CLOSED") updateData.closedAt = new Date();
    if (data.status === "OPEN") {
      updateData.closedAt = null;
      updateData.closePrice = null;
    }

    // Atomic: ownership check + update in one query — no TOCTOU window
    const result = await prisma.userPosition.updateMany({
      where: { id, userId },
      data: updateData,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    const position = await prisma.userPosition.findUnique({ where: { id, userId } });
    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    return NextResponse.json({ position });
  } catch (error) {
    return handleApiError(error, "/api/portfolio/[id] PATCH");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    // Atomic: ownership check + delete in one query — no TOCTOU window
    const result = await prisma.userPosition.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "/api/portfolio/[id] DELETE");
  }
}
