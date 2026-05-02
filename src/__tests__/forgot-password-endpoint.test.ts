import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("AUTH_SECRET", "test-secret-for-forgot-password");

// Mock prisma
const mockUserFindUnique = vi.fn();
const mockTokenCreate = vi.fn();
const mockTokenUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    passwordResetToken: {
      create: (...args: unknown[]) => mockTokenCreate(...args),
      updateMany: (...args: unknown[]) => mockTokenUpdateMany(...args),
    },
  },
}));

// Mock rate limiting
const mockIsRateLimited = vi.fn((..._args: unknown[]) => false as boolean);
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
  getClientIP: () => "127.0.0.1",
}));

// Mock email sending
const mockSendPasswordResetEmail = vi.fn((..._args: unknown[]) => Promise.resolve(true));
vi.mock("@/lib/email/password-reset", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

const { POST } = await import("@/app/api/auth/forgot-password/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockResolvedValue({ id: "token_1" });
  });

  it("returns generic message when user exists", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", email: "test@example.com" });

    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset link has been sent");
    expect(mockTokenCreate).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail.mock.calls[0][0]).toBe("test@example.com");
  });

  it("returns same generic message for non-existent email (no enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: "nobody@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset link has been sent");
    expect(mockTokenCreate).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockIsRateLimited.mockReturnValue(true);

    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("invalidates existing tokens before creating new one", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", email: "test@example.com" });

    await POST(makeRequest({ email: "test@example.com" }));

    expect(mockTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", usedAt: null },
      })
    );
    expect(mockTokenCreate).toHaveBeenCalledOnce();
  });
});
