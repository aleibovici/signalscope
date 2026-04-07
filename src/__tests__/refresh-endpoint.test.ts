import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("AUTH_SECRET", "test-secret-for-refresh-endpoint");

// Mock prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreateToken = vi.fn();
const mockTransaction = vi.fn((fns: unknown[]) => Promise.all(fns));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      create: (...args: unknown[]) => mockCreateToken(...args),
    },
    $transaction: (fns: unknown[]) => mockTransaction(fns),
  },
}));

// Mock rate limiting
const mockIsRateLimited = vi.fn(() => false);
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
  getClientIP: () => "127.0.0.1",
}));

// Mock mobile-jwt
vi.mock("@/lib/mobile-jwt", () => ({
  signAccessToken: () => Promise.resolve("new-access-token"),
  generateRefreshToken: () => "new-refresh-token",
  getRefreshTokenExpiry: () => new Date("2026-04-01"),
}));

const { POST } = await import("@/app/api/auth/refresh/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validToken = {
  id: "rt_1",
  token: "old-refresh-token",
  userId: "user_1",
  expiresAt: new Date("2026-12-01"),
  revokedAt: null,
  deviceId: "iphone",
  user: { id: "user_1", email: "test@example.com", role: "user" },
};

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it("rotates tokens on valid refresh token", async () => {
    mockFindUnique.mockResolvedValue(validToken);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockCreateToken.mockResolvedValue({});

    const res = await POST(makeRequest({ refreshToken: "old-refresh-token" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accessToken).toBe("new-access-token");
    expect(json.refreshToken).toBe("new-refresh-token");
    expect(json.expiresIn).toBe(900);
  });

  it("returns 401 for expired refresh token", async () => {
    mockFindUnique.mockResolvedValue({
      ...validToken,
      expiresAt: new Date("2020-01-01"),
    });

    const res = await POST(makeRequest({ refreshToken: "old-refresh-token" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for revoked refresh token", async () => {
    mockFindUnique.mockResolvedValue({
      ...validToken,
      revokedAt: new Date("2026-01-01"),
    });

    const res = await POST(makeRequest({ refreshToken: "old-refresh-token" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-existent token", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ refreshToken: "does-not-exist" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing refreshToken field", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockIsRateLimited.mockReturnValue(true);

    const res = await POST(makeRequest({ refreshToken: "old-refresh-token" }));
    expect(res.status).toBe(429);
  });
});
