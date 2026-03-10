import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockScanFindFirst = vi.fn();
const mockValidatedTickerFindMany = vi.fn();
const mockSendConfirmedTickerAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: { findFirst: (...args: unknown[]) => mockScanFindFirst(...args) },
    validatedTicker: { findMany: (...args: unknown[]) => mockValidatedTickerFindMany(...args) },
  },
}));

vi.mock("@/lib/email", () => ({
  sendConfirmedTickerAlerts: (...args: unknown[]) => mockSendConfirmedTickerAlerts(...args),
}));

const { POST } = await import("@/app/api/alerts/send/route");

function makeRequest(headers: Record<string, string> = {}): NextRequest {
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
    const res = await POST(makeRequest({ "x-cron-secret": "cron-secret" }));
    expect(res.status).toBe(503);
    expect(mockScanFindFirst).not.toHaveBeenCalled();
    expect(mockSendConfirmedTickerAlerts).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is missing", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is invalid", async () => {
    const res = await POST(makeRequest({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("sends alerts for latest completed scan when authorized", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_123", completedAt: new Date() });
    mockValidatedTickerFindMany.mockResolvedValue([
      { symbol: "AAPL", price: 200, aiScore: 78, catalyst: "earnings beat", signalType: "multi_source" },
    ]);

    const res = await POST(makeRequest({ "x-cron-secret": "cron-secret" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.scanId).toBe("scan_123");
    expect(json.tickerCount).toBe(1);
    expect(mockSendConfirmedTickerAlerts).toHaveBeenCalledWith([
      {
        symbol: "AAPL",
        price: 200,
        aiScore: 78,
        catalyst: "earnings beat",
        signalType: "multi_source",
      },
    ]);
  });
});
