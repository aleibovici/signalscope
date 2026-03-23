import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockScanFindFirst = vi.fn();
const mockValidatedTickerFindMany = vi.fn();
const mockSendTickerAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mockScanFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mockValidatedTickerFindMany(...args),
    },
  },
}));

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
    expect(mockSendTickerAlerts).not.toHaveBeenCalled();
  });

  it("returns 401 when x-snapshot-key is wrong", async () => {
    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");

    const res = await POST(makeRequest({ "x-snapshot-key": "anything" }));
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
    expect(mockValidatedTickerFindMany).not.toHaveBeenCalled();
    expect(mockSendTickerAlerts).not.toHaveBeenCalled();
  });

  it("sends alerts for authorized requests", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany.mockResolvedValue([
      {
        symbol: "AAPL",
        price: 180,
        aiScore: 70,
        catalyst: "Earnings beat",
        signalType: "multi_source",
        stage: "EARLY",
      },
      {
        symbol: "TSLA",
        price: 200,
        aiScore: 65,
        catalyst: "Options flow",
        signalType: "options_flow",
        stage: "FORMING",
      },
    ]);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.scanId).toBe("scan_1");
    expect(json.tickerCount).toBe(2);
    expect(json.totalAvailable).toBe(2);
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);
  });
});
