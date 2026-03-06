import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockSendConfirmedTickerAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendConfirmedTickerAlerts: (...args: unknown[]) =>
    mockSendConfirmedTickerAlerts(...args),
}));

const { POST } = await import("@/app/api/alerts/send/route");

function makeRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set("x-cron-secret", secret);
  return new NextRequest("http://localhost:3000/api/alerts/send", {
    method: "POST",
    headers,
  });
}

describe("POST /api/alerts/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await POST(makeRequest("cron-secret"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Endpoint not configured" });
  });

  it("returns 401 for missing or invalid secret", async () => {
    const resMissing = await POST(makeRequest());
    const resInvalid = await POST(makeRequest("wrong-secret"));

    expect(resMissing.status).toBe(401);
    expect(resInvalid.status).toBe(401);
  });

  it("returns skip when no completed scan exists", async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest("cron-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "skip", reason: "no completed scan" });
    expect(mockSendConfirmedTickerAlerts).not.toHaveBeenCalled();
  });

  it("sends alerts for latest completed scan with valid secret", async () => {
    mockFindFirst.mockResolvedValue({
      id: "scan_1",
      status: "COMPLETED",
      completedAt: new Date("2026-03-06T00:00:00.000Z"),
    });
    mockFindMany.mockResolvedValue([
      {
        symbol: "AAPL",
        price: 200,
        aiScore: 82,
        catalyst: "Earnings",
        signalType: "multi_source",
      },
    ]);
    mockSendConfirmedTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest("cron-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "sent", scanId: "scan_1", tickerCount: 1 });
    expect(mockSendConfirmedTickerAlerts).toHaveBeenCalledWith([
      {
        symbol: "AAPL",
        price: 200,
        aiScore: 82,
        catalyst: "Earnings",
        signalType: "multi_source",
      },
    ]);
  });
});
