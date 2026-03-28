import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const { POST } = await import("@/app/api/stripe/webhook/route");

function makeRequest(body: string, signature = "sig_test") {
  return new NextRequest("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when signature is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing stripe-signature");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
  });

  it("handles checkout.session.completed — creates subscription", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          subscription: "sub_123",
          metadata: { userId: "user_1" },
        },
      },
    });
    mockRetrieve.mockResolvedValue({
      id: "sub_123",
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      items: {
        data: [{
          price: { id: "price_monthly" },
        }],
      },
    });
    mockUpsert.mockResolvedValue({});

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0].where).toEqual({ userId: "user_1" });
    expect(mockUpsert.mock.calls[0][0].create.stripeSubscriptionId).toBe("sub_123");
  });

  it("handles customer.subscription.updated", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "active",
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
          items: {
            data: [{
              price: { id: "price_yearly" },
            }],
          },
          cancel_at_period_end: false,
          canceled_at: null,
        },
      },
    });
    mockFindUnique.mockResolvedValue({ id: "db_sub_1" });
    mockUpdate.mockResolvedValue({});

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.status).toBe("ACTIVE");
  });

  it("handles customer.subscription.deleted", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: { id: "sub_123", status: "canceled" },
      },
    });
    mockFindUnique.mockResolvedValue({ id: "db_sub_1" });
    mockUpdate.mockResolvedValue({});

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.status).toBe("CANCELED");
  });

  it("handles invoice.payment_failed — sets PAST_DUE", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          parent: {
            subscription_details: { subscription: "sub_123" },
          },
        },
      },
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_123" },
      data: { status: "PAST_DUE" },
    });
  });

  it("handles invoice.paid — resets to ACTIVE", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          parent: {
            subscription_details: { subscription: "sub_123" },
          },
        },
      },
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_123", status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });
  });

  it("ignores unknown event types gracefully", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
  });
});
