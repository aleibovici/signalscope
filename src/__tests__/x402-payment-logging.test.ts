import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock @x402/next so withX402 is a transparent passthrough (no real facilitator calls)
vi.mock("@x402/next", () => ({
  x402ResourceServer: class {
    register() { return this; }
  },
  withX402: (handler: (req: NextRequest) => Promise<NextResponse>) => handler,
}));

// Mock @x402/core/server and @x402/evm/exact/server — they are instantiated at module level
vi.mock("@x402/core/server", () => ({
  HTTPFacilitatorClient: class {},
}));
vi.mock("@x402/evm/exact/server", () => ({
  ExactEvmScheme: class {},
}));

// Mock prisma — capture x402Payment.create calls
const mockX402Create = vi.fn().mockResolvedValue({ id: "pay_1" });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    x402Payment: { create: (...args: unknown[]) => mockX402Create(...args) },
  },
}));

const { logX402Payment, withX402Logged, x402RouteConfigs } = await import(
  "@/lib/x402"
);

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeX402Header(payerAddress: string): string {
  const payload = {
    x402Version: 1,
    accepted: { scheme: "exact", network: "eip155:8453" },
    payload: {
      from: payerAddress,
      to: "0xRecipientAddress",
      value: "10000",
      validAfter: "0",
      validBefore: String(Date.now() + 60_000),
      nonce: "0xabc",
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function makeRequest(
  url = "http://localhost:3000/api/tickers/trending",
  xPayment?: string,
): NextRequest {
  return new NextRequest(url, {
    headers: xPayment ? { "x-payment": xPayment } : {},
  });
}

// ─── logX402Payment ───────────────────────────────────────────────────────────

describe("logX402Payment", () => {
  beforeEach(() => {
    mockX402Create.mockClear();
  });

  it("creates a DB record with endpoint and amountUsd", async () => {
    const req = makeRequest();
    await logX402Payment(req, "trending", "0.01");

    expect(mockX402Create).toHaveBeenCalledOnce();
    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "trending", amountUsd: "0.01", payerAddress: null },
    });
  });

  it("extracts payer address from x-payment header", async () => {
    const payer = "0xDeadBeef1234567890AbCdEf";
    const req = makeRequest(
      "http://localhost:3000/api/tickers/trending",
      makeX402Header(payer),
    );
    await logX402Payment(req, "trending", "0.01");

    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "trending", amountUsd: "0.01", payerAddress: payer },
    });
  });

  it("stores payerAddress as null when no x-payment header", async () => {
    const req = makeRequest();
    await logX402Payment(req, "report", "0.05");

    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "report", amountUsd: "0.05", payerAddress: null },
    });
  });

  it("stores payerAddress as null when header is malformed base64", async () => {
    const req = makeRequest("http://localhost:3000/api/tickers/trending", "not-valid-base64!!!");
    await logX402Payment(req, "ticker", "0.005");

    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "ticker", amountUsd: "0.005", payerAddress: null },
    });
  });

  it("stores payerAddress as null when payload.from is missing", async () => {
    const payload = { x402Version: 1, payload: { to: "0xRecipient" } };
    const header = Buffer.from(JSON.stringify(payload)).toString("base64");
    const req = makeRequest("http://localhost:3000/api/tickers/trending", header);
    await logX402Payment(req, "ticker", "0.005");

    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "ticker", amountUsd: "0.005", payerAddress: null },
    });
  });
});

// ─── withX402Logged ───────────────────────────────────────────────────────────

describe("withX402Logged", () => {
  beforeEach(() => {
    mockX402Create.mockClear();
  });

  it("calls the inner handler and logs a payment record", async () => {
    const payer = "0xAgentWallet";
    const innerHandler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withX402Logged(
      innerHandler,
      x402RouteConfigs.trending,
      "trending",
    );

    const req = makeRequest(
      "http://localhost:3000/api/tickers/trending",
      makeX402Header(payer),
    );
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(innerHandler).toHaveBeenCalledOnce();
    // Wait for the async log to flush (it's fire-and-forget)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockX402Create).toHaveBeenCalledWith({
      data: { endpoint: "trending", amountUsd: "0.01", payerAddress: payer },
    });
  });

  it("extracts the correct amountUsd from route config", async () => {
    const innerHandler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    for (const [key, amountUsd] of [
      ["trending", "0.01"],
      ["network", "0.01"],
      ["report", "0.05"],
      ["ticker", "0.005"],
      ["related", "0.005"],
      ["history", "0.005"],
      ["performance", "0.005"],
    ] as const) {
      mockX402Create.mockClear();
      const config = x402RouteConfigs[key as keyof typeof x402RouteConfigs];
      const wrapped = withX402Logged(innerHandler, config, key);
      const req = makeRequest();
      await wrapped(req);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockX402Create).toHaveBeenCalledWith({
        data: expect.objectContaining({ endpoint: key, amountUsd }),
      });
    }
  });

  it("still calls handler even if DB write fails", async () => {
    mockX402Create.mockRejectedValueOnce(new Error("DB unavailable"));
    const innerHandler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ data: "secret" }));
    const wrapped = withX402Logged(
      innerHandler,
      x402RouteConfigs.ticker,
      "ticker",
    );

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: "secret" });
    expect(innerHandler).toHaveBeenCalledOnce();
  });
});

// ─── admin payments endpoint ──────────────────────────────────────────────────

describe("GET /api/admin/payments", () => {
  const mockAdminFindUnique = vi.fn();
  const mockCount = vi.fn();
  const mockGroupBy = vi.fn();
  const mockFindMany = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockAdminFindUnique.mockClear();
    mockCount.mockClear();
    mockGroupBy.mockClear();
    mockFindMany.mockClear();
  });

  it("returns 403 for non-admin users", async () => {
    vi.doMock("@/lib/auth", () => ({
      getCurrentUserId: vi.fn().mockResolvedValue("user_1"),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ role: "user" }),
        },
        x402Payment: {
          count: vi.fn(),
          groupBy: vi.fn(),
          findMany: vi.fn(),
        },
      },
    }));

    const { GET } = await import("@/app/api/admin/payments/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns payment stats for admin users", async () => {
    const now = new Date();
    const mockPayments = [
      { id: "p1", endpoint: "trending", amountUsd: "0.01", payerAddress: "0xABC", createdAt: now },
      { id: "p2", endpoint: "report", amountUsd: "0.05", payerAddress: null, createdAt: now },
    ];

    vi.doMock("@/lib/auth", () => ({
      getCurrentUserId: vi.fn().mockResolvedValue("admin_1"),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ role: "admin" }),
        },
        x402Payment: {
          count: vi.fn().mockResolvedValue(2),
          groupBy: vi.fn().mockResolvedValue([
            { endpoint: "trending", amountUsd: "0.01", _count: { endpoint: 1 } },
            { endpoint: "report", amountUsd: "0.05", _count: { endpoint: 1 } },
          ]),
          findMany: vi
            .fn()
            .mockResolvedValueOnce(mockPayments) // last7d
            .mockResolvedValueOnce(mockPayments) // last30d
            .mockResolvedValueOnce(mockPayments) // recentPayments
            .mockResolvedValueOnce(mockPayments), // allPayments
        },
      },
    }));

    const { GET } = await import("@/app/api/admin/payments/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.total).toBe(2);
    expect(body.allTimeRevenue).toBeCloseTo(0.06);
    expect(body.last7d.count).toBe(2);
    expect(body.last7d.revenue).toBeCloseTo(0.06);
    expect(body.byEndpoint).toHaveLength(2);
    expect(body.recentPayments).toHaveLength(2);
    // Payer address preserved
    expect(body.recentPayments[0].payerAddress).toBe("0xABC");
    expect(body.recentPayments[1].payerAddress).toBeNull();
  });
});
