import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockScanFindFirst = vi.fn();
const mockValidatedTickerFindMany = vi.fn();
const mockValidatedTickerCount = vi.fn();
const mockSendTickerAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mockScanFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mockValidatedTickerFindMany(...args),
      count: (...args: unknown[]) => mockValidatedTickerCount(...args),
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

  it("sends high-conviction EARLY alerts for authorized requests", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany.mockResolvedValue([
      {
        symbol: "AAPL",
        price: 180,
        aiScore: 75,
        catalyst: "Insider buy $2M",
        signalType: "insider_buy",
        stage: "EARLY",
      },
      {
        symbol: "NVDA",
        price: 500,
        aiScore: 60,
        catalyst: "Unusual options flow",
        signalType: "options_flow",
        stage: "EARLY",
      },
    ]);
    mockValidatedTickerCount.mockResolvedValue(12);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.scanId).toBe("scan_1");
    expect(json.tickerCount).toBe(2);
    expect(json.totalAvailable).toBe(12);
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);

    // Verify the EARLY query: aiScore >= 50, not P&D, no priorAppearances/catalyst hard filters
    const findManyCall = mockValidatedTickerFindMany.mock.calls[0][0];
    expect(findManyCall.where.stage).toBe("EARLY");
    expect(findManyCall.where.aiScore).toEqual({ gte: 50 });
    expect(findManyCall.where.pndFlagged).toBe(false);
    expect(findManyCall.where.priorAppearances).toBeUndefined();
    expect(findManyCall.where.catalyst).toBeUndefined();
    expect(findManyCall.take).toBe(6);
  });

  it("falls back to FORMING when no EARLY tickers qualify", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany
      .mockResolvedValueOnce([]) // EARLY query returns nothing
      .mockResolvedValueOnce([   // FORMING fallback
        {
          symbol: "GS",
          price: 400,
          aiScore: 72,
          catalyst: "Congress buy",
          signalType: "congress_buy",
          stage: "FORMING",
        },
      ]);
    mockValidatedTickerCount.mockResolvedValue(8);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tickerCount).toBe(1);
    expect(json.totalAvailable).toBe(8);

    // First call: EARLY, second call: FORMING fallback
    expect(mockValidatedTickerFindMany).toHaveBeenCalledTimes(2);
    expect(mockValidatedTickerFindMany.mock.calls[0][0].where.stage).toBe("EARLY");
    expect(mockValidatedTickerFindMany.mock.calls[1][0].where.stage).toBe("FORMING");

    // sendTickerAlerts called with the FORMING tickers
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);
    expect(mockSendTickerAlerts.mock.calls[0][0][0].symbol).toBe("GS");
    expect(mockSendTickerAlerts.mock.calls[0][0][0].stage).toBe("FORMING");
  });

  it("sends empty alert when neither EARLY nor FORMING tickers qualify", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany.mockResolvedValue([]); // both queries return empty
    mockValidatedTickerCount.mockResolvedValue(5);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.tickerCount).toBe(0);
    expect(json.totalAvailable).toBe(5);
    expect(mockValidatedTickerFindMany).toHaveBeenCalledTimes(2);
    expect(mockSendTickerAlerts).toHaveBeenCalledWith([], 5);
  });
});
