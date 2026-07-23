import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

vi.stubEnv("AUTH_SECRET", "test-secret-for-reset-password");

// Mock prisma
const mockTokenFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockTokenUpdate = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();
const mockTransaction = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    passwordResetToken: {
      findUnique: (...args: unknown[]) => mockTokenFindUnique(...args),
      update: (...args: unknown[]) => mockTokenUpdate(...args),
    },
    user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
    refreshToken: { updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock bcrypt
const mockHash = vi.fn((..._args: unknown[]) => Promise.resolve("$2a$12$newhash"));
vi.mock("bcryptjs", () => ({ default: { hash: (...args: unknown[]) => mockHash(...args) } }));

// Mock rate limiting
const mockIsRateLimited = vi.fn((..._args: unknown[]) => false as boolean);
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
  getClientIP: () => "127.0.0.1",
}));

const { POST } = await import("@/app/api/auth/reset-password/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RAW_TOKEN = "a".repeat(64);
const HASHED_TOKEN = createHash("sha256").update(RAW_TOKEN).digest("hex");

const validResetToken = {
  id: "prt_1",
  token: HASHED_TOKEN,
  userId: "user_1",
  expiresAt: new Date(Date.now() + 3600_000),
  usedAt: null,
  user: { id: "user_1" },
};

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockTransaction.mockResolvedValue([]);
  });

  it("resets password with valid token", async () => {
    mockTokenFindUnique.mockResolvedValue(validResetToken);

    const res = await POST(makeRequest({ token: RAW_TOKEN, password: "newpassword123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Password has been reset.");
    expect(mockHash).toHaveBeenCalledWith("newpassword123", 12);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid token", async () => {
    mockTokenFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ token: "badtoken", password: "newpassword123" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid or expired");
  });

  it("returns 400 for already-used token", async () => {
    mockTokenFindUnique.mockResolvedValue({
      ...validResetToken,
      usedAt: new Date(),
    });

    const res = await POST(makeRequest({ token: RAW_TOKEN, password: "newpassword123" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("already been used");
  });

  it("returns 400 for expired token", async () => {
    mockTokenFindUnique.mockResolvedValue({
      ...validResetToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await POST(makeRequest({ token: RAW_TOKEN, password: "newpassword123" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("expired");
  });

  it("returns 429 when rate limited", async () => {
    mockIsRateLimited.mockReturnValue(true);

    const res = await POST(makeRequest({ token: RAW_TOKEN, password: "newpassword123" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for short password", async () => {
    const res = await POST(makeRequest({ token: RAW_TOKEN, password: "short" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("8 characters");
  });

  it("returns 400 for missing token", async () => {
    const res = await POST(makeRequest({ password: "newpassword123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing password", async () => {
    const res = await POST(makeRequest({ token: RAW_TOKEN }));
    expect(res.status).toBe(400);
  });
});
