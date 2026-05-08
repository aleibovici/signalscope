import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

const { hasActiveSubscription, getSubscriptionForApi } = await import(
  "@/lib/subscription"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasActiveSubscription", () => {
  it("returns true for ACTIVE subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "ACTIVE" });
    expect(await hasActiveSubscription("user_1")).toBe(true);
  });

  it("returns true for PAST_DUE subscription (grace period)", async () => {
    mockFindUnique.mockResolvedValue({ status: "PAST_DUE" });
    expect(await hasActiveSubscription("user_1")).toBe(true);
  });

  it("returns false for CANCELED subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "CANCELED" });
    expect(await hasActiveSubscription("user_1")).toBe(false);
  });

  it("returns false for UNPAID subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "UNPAID" });
    expect(await hasActiveSubscription("user_1")).toBe(false);
  });

  it("returns false when no subscription exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await hasActiveSubscription("user_1")).toBe(false);
  });
});

describe("getSubscriptionForApi", () => {
  it("returns null when no subscription", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getSubscriptionForApi("user_1")).toBeNull();
  });

  it("returns formatted Stripe subscription with isActive true for ACTIVE", async () => {
    const now = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      provider: "STRIPE",
      status: "ACTIVE",
      stripePriceId: "price_123",
      appleProductId: null,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now,
    });

    const result = await getSubscriptionForApi("user_1");
    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(true);
    expect(result!.status).toBe("ACTIVE");
    expect(result!.provider).toBe("STRIPE");
    expect(result!.productId).toBe("price_123");
    expect(result!.managementUrl).toContain("/api/stripe/portal");
    expect(result!.cancelAtPeriodEnd).toBe(false);
    expect(result!.canceledAt).toBeNull();
  });

  it("routes APPLE provider to App Store management URL", async () => {
    const now = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      provider: "APPLE",
      status: "ACTIVE",
      stripePriceId: null,
      appleProductId: "com.signalscopes.ios.pro.monthly",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now,
    });

    const result = await getSubscriptionForApi("user_1");
    expect(result!.provider).toBe("APPLE");
    expect(result!.productId).toBe("com.signalscopes.ios.pro.monthly");
    expect(result!.managementUrl).toContain("apps.apple.com");
  });

  it("returns isActive false for CANCELED subscription", async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue({
      provider: "STRIPE",
      status: "CANCELED",
      stripePriceId: "price_123",
      appleProductId: null,
      currentPeriodEnd: now,
      cancelAtPeriodEnd: true,
      canceledAt: now,
      createdAt: now,
    });

    const result = await getSubscriptionForApi("user_1");
    expect(result!.isActive).toBe(false);
    expect(result!.canceledAt).not.toBeNull();
  });
});
