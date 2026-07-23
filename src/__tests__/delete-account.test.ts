import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getCurrentUserId
const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Mock prisma — hard-delete contract: only user.findUniqueOrThrow + user.delete.
// All child rows are removed via Postgres cascade (onDelete: Cascade in schema).
const mockFindUniqueOrThrow = vi.fn();
const mockUserDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      delete: (...args: unknown[]) => mockUserDelete(...args),
    },
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
    mockUserDelete.mockResolvedValue({ id: USER_ID });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await DELETE();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("hard-deletes the user (cascade removes child rows)", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: null,
    });

    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(mockStripeCancel).not.toHaveBeenCalled();
  });

  it("cancels active Stripe subscription before deletion", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: {
        provider: "STRIPE",
        status: "ACTIVE",
        stripeSubscriptionId: "sub_456",
        appleOriginalTransactionId: null,
      },
    });
    mockStripeCancel.mockResolvedValue({});

    const res = await DELETE();
    expect(res.status).toBe(200);

    expect(mockStripeCancel).toHaveBeenCalledWith("sub_456");
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it("cancels PAST_DUE Stripe subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: {
        provider: "STRIPE",
        status: "PAST_DUE",
        stripeSubscriptionId: "sub_789",
        appleOriginalTransactionId: null,
      },
    });
    mockStripeCancel.mockResolvedValue({});

    await DELETE();

    expect(mockStripeCancel).toHaveBeenCalledWith("sub_789");
  });

  it("does not call Stripe cancel for already-canceled subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: {
        provider: "STRIPE",
        status: "CANCELED",
        stripeSubscriptionId: "sub_old",
        appleOriginalTransactionId: null,
      },
    });

    await DELETE();

    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(mockUserDelete).toHaveBeenCalledTimes(1);
  });

  it("proceeds with deletion even if Stripe cancel fails", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: {
        provider: "STRIPE",
        status: "ACTIVE",
        stripeSubscriptionId: "sub_fail",
        appleOriginalTransactionId: null,
      },
    });
    mockStripeCancel.mockRejectedValue(new Error("Stripe API error"));

    const res = await DELETE();
    expect(res.status).toBe(200);

    expect(mockUserDelete).toHaveBeenCalledTimes(1);
  });

  it("does not call Stripe when user has no subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: null,
    });

    await DELETE();

    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(mockUserDelete).toHaveBeenCalledTimes(1);
  });

  it("still deletes user with a non-Stripe active subscription", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      subscription: {
        provider: "APPLE",
        status: "ACTIVE",
        stripeSubscriptionId: null,
      },
    });

    const res = await DELETE();
    expect(res.status).toBe(200);

    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(mockUserDelete).toHaveBeenCalledTimes(1);
  });
});
