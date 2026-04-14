import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Prisma mocks ──────────────────────────────────────────────────────────────

const mockUserFindUniqueOrThrow = vi.fn();
const mockUserUpdate = vi.fn();
const mockSubscriptionFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockUserFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mockSubscriptionFindUnique(...args),
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockPortalSessionsCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
      },
    },
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockPortalSessionsCreate(...args),
      },
    },
  },
  PRICE_IDS: {
    monthly: "price_monthly_test",
    yearly: "price_yearly_test",
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const { POST: checkoutPOST } = await import("@/app/api/stripe/checkout/route");
const { POST: portalPOST } = await import("@/app/api/stripe/portal/route");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCheckoutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePortalRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/portal", {
    method: "POST",
  });
}

// ── Tests: POST /api/stripe/checkout ─────────────────────────────────────────

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await checkoutPOST(makeCheckoutRequest({ period: "monthly" }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 for an invalid period value (Zod validation)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await checkoutPOST(makeCheckoutRequest({ period: "quarterly" }));

    expect(res.status).toBe(400);
    expect(mockUserFindUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("returns 400 when user already has an ACTIVE subscription", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue({ status: "ACTIVE" });

    const res = await checkoutPOST(makeCheckoutRequest({ period: "monthly" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already have an active subscription/i);
    // Must not create a new checkout session
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when user has a PAST_DUE subscription (grace period also blocks new checkout)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue({ status: "PAST_DUE" });

    const res = await checkoutPOST(makeCheckoutRequest({ period: "yearly" }));

    expect(res.status).toBe(400);
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer lazily when stripeCustomerId is null", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "new@example.com",
      stripeCustomerId: null,
    });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockUserUpdate.mockResolvedValue({});
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_new",
    });

    const res = await checkoutPOST(makeCheckoutRequest({ period: "monthly" }));

    expect(res.status).toBe(200);
    // Customer must be created with correct email and userId metadata
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "new@example.com",
      metadata: { userId: "user_1" },
    });
    // New customerId must be persisted to the user record
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeCustomerId: "cus_new" } })
    );
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_new");
  });

  it("skips customer creation when user already has a stripeCustomerId", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_existing",
    });

    const res = await checkoutPOST(makeCheckoutRequest({ period: "yearly" }));

    expect(res.status).toBe(200);
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    // Must pass the existing customer ID to the Stripe session
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_existing");
  });

  it("passes the correct priceId for the monthly period", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/cs_m" });

    await checkoutPOST(makeCheckoutRequest({ period: "monthly" }));

    const call = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(call.line_items[0].price).toBe("price_monthly_test");
  });

  it("passes the correct priceId for the yearly period", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/cs_y" });

    await checkoutPOST(makeCheckoutRequest({ period: "yearly" }));

    const call = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(call.line_items[0].price).toBe("price_yearly_test");
  });

  it("embeds userId in checkout session metadata", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_42");
    mockUserFindUniqueOrThrow.mockResolvedValue({
      email: "alice@example.com",
      stripeCustomerId: "cus_existing",
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/cs_meta" });

    await checkoutPOST(makeCheckoutRequest({ period: "monthly" }));

    const call = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(call.metadata).toEqual({ userId: "user_42" });
  });
});

// ── Tests: POST /api/stripe/portal ───────────────────────────────────────────

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await portalPOST(makePortalRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 when user has no stripeCustomerId (never subscribed)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({ stripeCustomerId: null });

    const res = await portalPOST(makePortalRequest());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no subscription found/i);
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns portal URL when user has an existing Stripe customer", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({ stripeCustomerId: "cus_123" });
    mockPortalSessionsCreate.mockResolvedValue({
      url: "https://billing.stripe.com/p/session_test",
    });

    const res = await portalPOST(makePortalRequest());

    expect(res.status).toBe(200);
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123" })
    );
    const json = await res.json();
    expect(json.url).toBe("https://billing.stripe.com/p/session_test");
  });

  it("includes a return_url in the portal session", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({ stripeCustomerId: "cus_123" });
    mockPortalSessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/s" });

    await portalPOST(makePortalRequest());

    const call = mockPortalSessionsCreate.mock.calls[0][0];
    expect(call.return_url).toBeDefined();
    expect(typeof call.return_url).toBe("string");
  });
});
