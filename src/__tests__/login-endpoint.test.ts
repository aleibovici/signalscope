import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("AUTH_SECRET", "test-secret-for-login-endpoint");

// Mock prisma
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    refreshToken: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// Mock bcrypt
const mockCompare = vi.fn();
vi.mock("bcryptjs", () => ({ default: { compare: (...args: unknown[]) => mockCompare(...args) } }));

// Mock rate limiting — allow everything by default
const mockIsRateLimited = vi.fn(() => false);
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
  getClientIP: () => "127.0.0.1",
}));

// Mock mobile-jwt
const mockSignAccessToken = vi.fn(() => Promise.resolve("mock-access-token"));
const mockGenerateRefreshToken = vi.fn(() => "mock-refresh-token");
const mockGetRefreshTokenExpiry = vi.fn(() => new Date("2026-04-01"));
vi.mock("@/lib/mobile-jwt", () => ({
  signAccessToken: (...args: unknown[]) => mockSignAccessToken(...args),
  generateRefreshToken: () => mockGenerateRefreshToken(),
  getRefreshTokenExpiry: () => mockGetRefreshTokenExpiry(),
}));

const { POST } = await import("@/app/api/auth/login/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fakeUser = {
  id: "user_1",
  email: "test@example.com",
  name: "Test",
  username: "tester",
  role: "user",
  passwordHash: "$2a$12$hashed",
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it("returns tokens on valid credentials", async () => {
    mockFindUnique.mockResolvedValue(fakeUser);
    mockCompare.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ id: "rt_1" });

    const res = await POST(makeRequest({ email: "test@example.com", password: "password123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accessToken).toBe("mock-access-token");
    expect(json.refreshToken).toBe("mock-refresh-token");
    expect(json.expiresIn).toBe(900);
    expect(json.user.id).toBe("user_1");
    expect(json.user.email).toBe("test@example.com");
  });

  it("returns 401 for wrong password", async () => {
    mockFindUnique.mockResolvedValue(fakeUser);
    mockCompare.mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "test@example.com", password: "wrong" }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("Invalid credentials");
  });

  it("returns 401 for unknown email", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: "nobody@test.com", password: "password123" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockIsRateLimited.mockReturnValue(true);

    const res = await POST(makeRequest({ email: "test@example.com", password: "password123" }));
    expect(res.status).toBe(429);
  });

  it("passes deviceId to refresh token creation", async () => {
    mockFindUnique.mockResolvedValue(fakeUser);
    mockCompare.mockResolvedValue(true);
    mockCreate.mockResolvedValue({ id: "rt_1" });

    await POST(makeRequest({ email: "test@example.com", password: "password123", deviceId: "iphone-15" }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: "iphone-15" }),
      })
    );
  });
});
