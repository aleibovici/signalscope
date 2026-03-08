import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPosition: { findMany: vi.fn() },
    priceSnapshot: { findMany: vi.fn() },
  },
}));

// Mock auth
const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const { GET } = await import("@/app/api/leaderboard/route");

function makeRequest(): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/leaderboard"));
}

describe("GET /api/leaderboard", () => {
  it("returns 503 — temporarily disabled", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/temporarily disabled/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});
