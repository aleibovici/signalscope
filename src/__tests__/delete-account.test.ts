import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getCurrentUserId
const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Mock prisma
const mockFindUniqueOrThrow = vi.fn();
const mockUserUpdate = vi.fn();
const mockSubscriptionDeleteMany = vi.fn();
const mockRefreshTokenDeleteMany = vi.fn();
const mockApiKeyDeleteMany = vi.fn();
const mockPasswordResetTokenDeleteMany = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    subscription: {
      deleteMany: (...args: unknown[]) => mockSubscriptionDeleteMany(...args),
    },
    refreshToken: {
      deleteMany: (...args: unknown[]) => mockRefreshTokenDeleteMany(...args),
    },
    apiKey: {
      deleteMany: (...args: unknown[]) => mockApiKeyDeleteMany(...args),
    },
    passwordResetToken: {
      deleteMany: (...args: unknown[]) => mockPasswordResetTokenDeleteMany(...args),
    },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

// Mock Stripe
const mockStripeCancel = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { cancel: (...args: unknown[]) => mockStripeCancel(...args) },
  }),
}));

const { DELETE } = await import("@/app/api/user/account/route");

const USER_ID = "user_abc123";

describe("DELETE /api/user/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue(USER_ID);
    mockUserUpdate.mockResolvedValue({});
    mockSubscriptionDeleteMany.mockResolvedValue({ count: 0 });
    mockRefreshTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockApiKeyDeleteMany.mockResolvedValue({ count: 0 });
    mockPasswordResetTokenDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await DELETE();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("soft-deletes user and anonymizes PII", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: null,
      subscription: null,
    });

    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify transaction was called
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Verify user update with anonymized data
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          email: `deleted_${USER_ID}@deleted.local`,
          passwordHash: null,
          name: null,
          username: null,
          stripeCustomerId: null,
          emailAlerts: false,
        }),
      })
    );
  });

  it("deletes all related records in transaction", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: null,
      subscription: null,
    });

    await DELETE();

    expect(mockSubscriptionDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockApiKeyDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockPasswordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("cancels active Stripe subscription before deletion", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: "cus_123",
      subscription: {
        stripeSubscriptionId: "sub_456",
        status: "ACTIVE",
      },
    });
    mockStripeCancel.mockResolvedValue({});

    const res = await DELETE();
    expect(res.status).toBe(200);

    expect(mockStripeCancel).toHaveBeenCalledWith("sub_456");
  });

  it("cancels PAST_DUE Stripe subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: "cus_123",
      subscription: {
        stripeSubscriptionId: "sub_789",
        status: "PAST_DUE",
      },
    });
    mockStripeCancel.mockResolvedValue({});

    await DELETE();

    expect(mockStripeCancel).toHaveBeenCalledWith("sub_789");
  });

  it("does not call Stripe cancel for already-canceled subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: "cus_123",
      subscription: {
        stripeSubscriptionId: "sub_old",
        status: "CANCELED",
      },
    });

    await DELETE();

    expect(mockStripeCancel).not.toHaveBeenCalled();
  });

  it("proceeds with deletion even if Stripe cancel fails", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: "cus_123",
      subscription: {
        stripeSubscriptionId: "sub_fail",
        status: "ACTIVE",
      },
    });
    mockStripeCancel.mockRejectedValue(new Error("Stripe API error"));

    const res = await DELETE();
    expect(res.status).toBe(200);

    // Transaction should still have been called
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("does not call Stripe when user has no subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      stripeCustomerId: null,
      subscription: null,
    });

    await DELETE();

    expect(mockStripeCancel).not.toHaveBeenCalled();
  });
});
