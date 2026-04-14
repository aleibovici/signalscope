import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Prisma mocks ──────────────────────────────────────────────────────────────

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/ga4-server", () => ({
  sendGA4Event: vi.fn(),
}));

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockConstructEvent = vi.fn();
const mockRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    },
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const { POST } = await import("@/app/api/stripe/webhook/route");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body = "{}") {
  return new NextRequest("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": "sig_test" },
  });
}

function makeSubscriptionUpdatedEvent(status: string) {
  return {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_123",
        status,
        items: {
          data: [
            {
              price: { id: "price_monthly" },
              current_period_start: 1_700_000_000,
              current_period_end: 1_700_000_000 + 30 * 86_400,
            },
          ],
        },
        cancel_at_period_end: false,
        canceled_at: null,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

// ── extractSubscriptionId edge cases ─────────────────────────────────────────

describe("extractSubscriptionId — invoice subscription reference variants", () => {
  it("extracts subscription ID when Stripe returns an expanded subscription object", async () => {
    // Stripe can return the subscription as a full object (expanded) rather than
    // a plain string — the handler must read `.id` from the object in that case.
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          parent: {
            subscription_details: {
              subscription: { id: "sub_expanded_obj", status: "past_due" },
            },
          },
        },
      },
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_expanded_obj" },
      })
    );
  });

  it("skips DB update when the invoice has no subscription reference (null path)", async () => {
    // An invoice that is not tied to a subscription (e.g. one-time invoice)
    // should be silently ignored — no updateMany call.
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          // No `parent` field — extractSubscriptionId must return null
        },
      },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("skips DB update when parent exists but subscription_details is absent", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          parent: {
            // subscription_details missing — e.g. quote-based invoice
          },
        },
      },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

// ── mapStripeStatus variants (via customer.subscription.updated) ──────────────
//
// These tests guard the access-control implications of each Stripe subscription
// status. Getting the mapping wrong changes which users can access paid features.

describe("mapStripeStatus", () => {
  beforeEach(() => {
    // DB subscription found so the handler proceeds to the update call
    mockFindUnique.mockResolvedValue({ id: "db_sub_1" });
    mockUpdate.mockResolvedValue({});
  });

  it("maps trialing → ACTIVE (trial users receive full paid access)", async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("trialing"));

    await POST(makeRequest());

    expect(mockUpdate.mock.calls[0][0].data.status).toBe("ACTIVE");
  });

  it("maps past_due → PAST_DUE (grace period — user retains access)", async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("past_due"));

    await POST(makeRequest());

    expect(mockUpdate.mock.calls[0][0].data.status).toBe("PAST_DUE");
  });

  it("maps paused → UNPAID (paused subscription loses paid access)", async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("paused"));

    await POST(makeRequest());

    expect(mockUpdate.mock.calls[0][0].data.status).toBe("UNPAID");
  });

  it("maps incomplete → UNPAID (payment setup incomplete, no paid access)", async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("incomplete"));

    await POST(makeRequest());

    expect(mockUpdate.mock.calls[0][0].data.status).toBe("UNPAID");
  });

  it("maps incomplete_expired → UNPAID", async () => {
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("incomplete_expired"));

    await POST(makeRequest());

    expect(mockUpdate.mock.calls[0][0].data.status).toBe("UNPAID");
  });

  it("skips update when no DB subscription matches the Stripe subscription ID", async () => {
    mockFindUnique.mockResolvedValue(null); // no matching DB record
    mockConstructEvent.mockReturnValue(makeSubscriptionUpdatedEvent("active"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
