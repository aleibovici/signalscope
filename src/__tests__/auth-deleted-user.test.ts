import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret-for-auth");

// Mock headers — controls which auth path getCurrentUserId takes
const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: (k: string) => mockHeadersGet(k) }),
}));

// Mock prisma
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockApiKeyFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: () => mockUserUpdate(),
    },
    apiKey: {
      findUnique: (...args: unknown[]) => mockApiKeyFindUnique(...args),
      updateMany: () => Promise.resolve(),
    },
  },
}));

// Mock mobile-jwt
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/mobile-jwt", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => false,
  isApiKeyRateLimited: () => false,
}));

// Mock next-auth — needed for the cookie session path
vi.mock("next-auth", () => ({
  default: () => ({
    auth: () => Promise.resolve(null),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock auth.config
vi.mock("@/lib/auth.config", () => ({
  authConfig: { providers: [] },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({ default: { compare: () => false } }));

const { getCurrentUserId } = await import("@/lib/auth");

describe("assertNotDeleted via getCurrentUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
  });

  describe("Bearer token path", () => {
    beforeEach(() => {
      mockHeadersGet.mockImplementation((key: string) => {
        if (key === "authorization") return "Bearer valid-token";
        return null;
      });
      mockVerifyAccessToken.mockResolvedValue({ sub: "user_123" });
    });

    it("rejects soft-deleted user", async () => {
      mockUserFindUnique.mockResolvedValue({ deletedAt: new Date("2026-01-01") });

      await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    });

    it("rejects non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    });

    it("allows active user", async () => {
      mockUserFindUnique.mockResolvedValue({ deletedAt: null });

      const userId = await getCurrentUserId();
      expect(userId).toBe("user_123");
    });
  });

  describe("API key path", () => {
    beforeEach(() => {
      mockHeadersGet.mockImplementation((key: string) => {
        if (key === "x-api-key") return "sk_sig_testkey";
        return null;
      });
      mockApiKeyFindUnique.mockResolvedValue({
        id: "ak_1",
        userId: "user_456",
        revokedAt: null,
      });
    });

    it("rejects soft-deleted user", async () => {
      mockUserFindUnique.mockResolvedValue({ deletedAt: new Date("2026-01-01") });

      await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    });

    it("rejects non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getCurrentUserId()).rejects.toThrow("Not authenticated");
    });

    it("allows active user", async () => {
      mockUserFindUnique.mockResolvedValue({ deletedAt: null });

      const userId = await getCurrentUserId();
      expect(userId).toBe("user_456");
    });
  });
});
