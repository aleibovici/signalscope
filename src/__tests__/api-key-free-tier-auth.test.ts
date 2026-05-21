import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret-for-auth");

// Mock headers — force x-api-key path
const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: (k: string) => mockHeadersGet(k) }),
}));

// Mock prisma
const mockApiKeyFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: () => Promise.resolve(),
    },
    apiKey: {
      findUnique: (...args: unknown[]) => mockApiKeyFindUnique(...args),
      updateMany: () => Promise.resolve(),
    },
  },
}));

// Rate-limit mocks — use vi.fn() so tests can override per case
const mockIsApiKeyRateLimited = vi.fn().mockReturnValue(false);
const mockCheckAndIncrementFreeApiKey = vi.fn().mockResolvedValue({ allowed: true });
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => false,
  isApiKeyRateLimited: (...args: unknown[]) => mockIsApiKeyRateLimited(...args),
  checkAndIncrementFreeApiKey: (...args: unknown[]) => mockCheckAndIncrementFreeApiKey(...args),
}));

vi.mock("@/lib/mobile-jwt", () => ({
  verifyAccessToken: () => Promise.resolve(null),
}));

vi.mock("next-auth", () => ({
  default: () => ({
    auth: () => Promise.resolve(null),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth.config", () => ({
  authConfig: { providers: [] },
}));

vi.mock("bcryptjs", () => ({ default: { compare: () => false } }));

const { getCurrentUserId } = await import("@/lib/auth");

describe("getCurrentUserId — API key free-tier rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === "x-api-key") return "sk_sig_testkey";
      return null;
    });
    mockUserFindUnique.mockResolvedValue({ deletedAt: null });
    mockIsApiKeyRateLimited.mockReturnValue(false);
    mockCheckAndIncrementFreeApiKey.mockResolvedValue({ allowed: true });
  });

  describe("free-tier user (no subscription)", () => {
    beforeEach(() => {
      mockApiKeyFindUnique.mockResolvedValue({
        id: "ak_free",
        userId: "user_free",
        revokedAt: null,
        user: { subscription: null },
      });
    });

    it("allows request when under monthly limit", async () => {
      mockCheckAndIncrementFreeApiKey.mockResolvedValue({ allowed: true });

      const userId = await getCurrentUserId();
      expect(userId).toBe("user_free");
      expect(mockCheckAndIncrementFreeApiKey).toHaveBeenCalledWith("ak_free");
    });

    it("throws 429-mapped error when monthly limit reached", async () => {
      mockCheckAndIncrementFreeApiKey.mockResolvedValue({ allowed: false });

      await expect(getCurrentUserId()).rejects.toThrow(
        "API key rate limit exceeded"
      );
    });

    it("does not call in-memory Pro rate limiter", async () => {
      await getCurrentUserId();
      expect(mockIsApiKeyRateLimited).not.toHaveBeenCalled();
    });
  });

  describe("free-tier user (canceled subscription)", () => {
    beforeEach(() => {
      mockApiKeyFindUnique.mockResolvedValue({
        id: "ak_canceled",
        userId: "user_canceled",
        revokedAt: null,
        user: { subscription: { status: "CANCELED" } },
      });
    });

    it("falls back to free-tier limit after cancellation", async () => {
      mockCheckAndIncrementFreeApiKey.mockResolvedValue({ allowed: false });

      await expect(getCurrentUserId()).rejects.toThrow(
        "API key rate limit exceeded"
      );
      expect(mockIsApiKeyRateLimited).not.toHaveBeenCalled();
    });
  });

  describe("Pro user (ACTIVE subscription)", () => {
    beforeEach(() => {
      mockApiKeyFindUnique.mockResolvedValue({
        id: "ak_pro",
        userId: "user_pro",
        revokedAt: null,
        user: { subscription: { status: "ACTIVE" } },
      });
    });

    it("uses in-memory rate limiter, not monthly counter", async () => {
      const userId = await getCurrentUserId();
      expect(userId).toBe("user_pro");
      expect(mockIsApiKeyRateLimited).toHaveBeenCalledWith("user_pro");
      expect(mockCheckAndIncrementFreeApiKey).not.toHaveBeenCalled();
    });

    it("throws when daily in-memory limit exceeded", async () => {
      mockIsApiKeyRateLimited.mockReturnValue(true);

      await expect(getCurrentUserId()).rejects.toThrow(
        "API key rate limit exceeded (1,000 requests/day)"
      );
      expect(mockCheckAndIncrementFreeApiKey).not.toHaveBeenCalled();
    });
  });

  describe("Pro user (PAST_DUE subscription)", () => {
    it("uses Pro path for PAST_DUE status", async () => {
      mockApiKeyFindUnique.mockResolvedValue({
        id: "ak_pastdue",
        userId: "user_pastdue",
        revokedAt: null,
        user: { subscription: { status: "PAST_DUE" } },
      });

      const userId = await getCurrentUserId();
      expect(userId).toBe("user_pastdue");
      expect(mockIsApiKeyRateLimited).toHaveBeenCalled();
      expect(mockCheckAndIncrementFreeApiKey).not.toHaveBeenCalled();
    });
  });
});
