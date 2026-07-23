import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

const { hasActiveSubscription, getSubscriptionForApi, isSubscriptionsEnabled } = await import(
  "@/lib/subscription"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSubscriptionsEnabled", () => {
  it("returns false when STRIPE_SECRET_KEY is unset", () => {
    expect(isSubscriptionsEnabled()).toBe(false);
  });
});

describe("hasActiveSubscription (billing disabled — default OSS)", () => {
  it("returns true even without a subscription row", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await hasActiveSubscription("user_1")).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("hasActiveSubscription (billing enabled)", () => {
  let billingHasActiveSubscription: typeof hasActiveSubscription;

  beforeEach(async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.resetModules();
    const mod = await import("@/lib/subscription");
    billingHasActiveSubscription = mod.hasActiveSubscription;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for ACTIVE subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "ACTIVE" });
    expect(await billingHasActiveSubscription("user_1")).toBe(true);
  });

  it("returns true for PAST_DUE subscription (grace period)", async () => {
    mockFindUnique.mockResolvedValue({ status: "PAST_DUE" });
    expect(await billingHasActiveSubscription("user_1")).toBe(true);
  });

  it("returns false for CANCELED subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "CANCELED" });
    expect(await billingHasActiveSubscription("user_1")).toBe(false);
  });

  it("returns false for UNPAID subscription", async () => {
    mockFindUnique.mockResolvedValue({ status: "UNPAID" });
    expect(await billingHasActiveSubscription("user_1")).toBe(false);
  });

  it("returns false when no subscription exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await billingHasActiveSubscription("user_1")).toBe(false);
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

  it("returns null managementUrl for non-Stripe subscriptions", async () => {
    const now = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      provider: "APPLE",
      status: "ACTIVE",
      stripePriceId: null,
      appleProductId: "legacy.product.id",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: now,
    });

    const result = await getSubscriptionForApi("user_1");
    expect(result!.provider).toBe("APPLE");
    expect(result!.productId).toBe("legacy.product.id");
    expect(result!.managementUrl).toBeNull();
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
