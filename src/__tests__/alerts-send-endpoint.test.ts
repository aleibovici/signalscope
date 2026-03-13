import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockScanFindFirst = vi.fn();
const mockTickerFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mockScanFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mockTickerFindMany(...args),
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
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when x-snapshot-key is wrong", async () => {
    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));
    expect(res.status).toBe(401);
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("returns 503 when SNAPSHOT_API_KEY env is not set", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");

    const res = await POST(makeRequest({ "x-snapshot-key": "any-key" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("Endpoint not configured");
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("returns skip when there is no completed scan", async () => {
    mockScanFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: "skip", reason: "no completed scan" });
    expect(mockSendTickerAlerts).not.toHaveBeenCalled();
  });

  it("sends alerts for authorized request", async () => {
    mockScanFindFirst.mockResolvedValue({
      id: "scan_123",
      status: "COMPLETED",
      completedAt: new Date("2026-03-13T10:00:00.000Z"),
    });
    mockTickerFindMany.mockResolvedValue([
      {
        symbol: "AAPL",
        price: 180.5,
        aiScore: 76,
        catalyst: "Options flow spike",
        signalType: "options_flow",
        stage: "EARLY",
      },
      {
        symbol: "TSLA",
        price: 210.25,
        aiScore: 71,
        catalyst: null,
        signalType: "reddit_velocity",
        stage: "FORMING",
      },
    ]);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      status: "sent",
      scanId: "scan_123",
      tickerCount: 2,
      totalAvailable: 2,
    });
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);
  });
});
