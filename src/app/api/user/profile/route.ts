import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { generateUsername } from "@/lib/username-generator";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    let user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    });

    if (!user.username) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          user = await prisma.user.update({
            where: { id: userId },
            data: { username: generateUsername() },
            select: { id: true, email: true, username: true },
          });
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002" &&
            attempt < 4
          ) {
            continue;
          }
          throw err;
        }
      }
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/user/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores"),
});

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { username: parsed.data.username },
      select: { id: true, email: true, username: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username is already taken" }, { status: 400 });
    }
    console.error("PATCH /api/user/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
