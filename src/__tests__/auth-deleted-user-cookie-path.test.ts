import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret-for-cookie-path");

// Hoisted so the mock factory can reference it
const mockSessionAuth = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<{ user?: { id?: string } } | null>>(() => Promise.resolve(null)));

// Mock headers — return null for all keys so Bearer and API-key paths are skipped
const mockHeadersGet = vi.fn((_k: string) => null as string | null);
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: (k: string) => mockHeadersGet(k) }),
}));

// Mock prisma
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: () => mockUserUpdate(),
    },
    apiKey: {
      findUnique: () => Promise.resolve(null),
      updateMany: () => Promise.resolve(),
    },
  },
}));

// Mock next-auth — auth() returns a controllable session
vi.mock("next-auth", () => ({
  default: () => ({
    auth: (...args: unknown[]) => mockSessionAuth(...args),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock auth.config
vi.mock("@/lib/auth.config", () => ({
  authConfig: { providers: [] },
}));

// Mock mobile-jwt (Bearer path is inactive, but the import must resolve)
vi.mock("@/lib/mobile-jwt", () => ({
  verifyAccessToken: vi.fn(),
}));

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => false,
  isApiKeyRateLimited: () => false,
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({ default: { compare: () => false } }));

const { getCurrentUserId } = await import("@/lib/auth");

describe("assertNotDeleted — cookie session path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
    // Ensure no Bearer or API key header is present
    mockHeadersGet.mockReturnValue(null);
  });

  it("rejects a soft-deleted user with a valid cookie session", async () => {
    mockSessionAuth.mockResolvedValue({ user: { id: "user_cookie_789" } });
    mockUserFindUnique.mockResolvedValue({ deletedAt: new Date("2026-01-01") });

    await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
  });

  it("rejects a non-existent user despite a valid cookie session", async () => {
    mockSessionAuth.mockResolvedValue({ user: { id: "user_ghost" } });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
  });

  it("allows an active user with a valid cookie session", async () => {
    mockSessionAuth.mockResolvedValue({ user: { id: "user_active_cookie" } });
    mockUserFindUnique.mockResolvedValue({ deletedAt: null });

    const userId = await getCurrentUserId();
    expect(userId).toBe("user_active_cookie");
  });

  it("rejects when session is present but user.id is missing", async () => {
    mockSessionAuth.mockResolvedValue({ user: {} });

    await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    // assertNotDeleted should never be reached — no DB lookup needed
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("rejects when auth() returns null (no session)", async () => {
    mockSessionAuth.mockResolvedValue(null);

    await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});
