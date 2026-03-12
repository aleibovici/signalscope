import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
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

const mockSendTickerAlerts = vi.fn();
vi.mock("@/lib/email", () => ({
  sendTickerAlerts: (...args: unknown[]) => mockSendTickerAlerts(...args),
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
    vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  });

  it("returns 401 when x-snapshot-key is missing", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockSendTickerAlerts).not.toHaveBeenCalled();
  });

  it("returns 401 when x-snapshot-key is wrong", async () => {
    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Endpoint not configured" });
  });

  it("sends alerts when authorized", async () => {
    mockFindFirst.mockResolvedValue({
      id: "scan_1",
      status: "COMPLETED",
      completedAt: new Date("2026-03-12T09:15:00.000Z"),
    });
    mockFindMany.mockResolvedValue([
      {
        symbol: "ABCD",
        price: 1.23,
        aiScore: 61,
        catalyst: "Insider buying",
        signalType: "insider_buy",
        stage: "EARLY",
      },
      {
        symbol: "WXYZ",
        price: 5.67,
        aiScore: 55,
        catalyst: "Volume spike",
        signalType: "multi_source",
        stage: "FORMING",
      },
    ]);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      status: "sent",
      scanId: "scan_1",
      tickerCount: 2,
      totalAvailable: 2,
    });
    expect(mockSendTickerAlerts).toHaveBeenCalledWith([
      {
        symbol: "ABCD",
        price: 1.23,
        aiScore: 61,
        catalyst: "Insider buying",
        signalType: "insider_buy",
        stage: "EARLY",
      },
      {
        symbol: "WXYZ",
        price: 5.67,
        aiScore: 55,
        catalyst: "Volume spike",
        signalType: "multi_source",
        stage: "FORMING",
      },
    ], 2);
  });
});
