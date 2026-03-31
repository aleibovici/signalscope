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

  it("prioritises EARLY > FORMING > CONFIRMED, then by aiScore", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany.mockResolvedValue([
      {
        symbol: "PANW",
        price: 154,
        aiScore: 85,
        aiReasoning: "CEO insider buy signals confidence",
        catalyst: "Insider buy $10M",
        signalType: "insider_buy",
        stage: "FORMING",
        opportunityScore: 60,
      },
      {
        symbol: "AAPL",
        price: 180,
        aiScore: 75,
        aiReasoning: "Multi-source convergence",
        catalyst: "Insider buy $2M",
        signalType: "insider_buy",
        stage: "EARLY",
        opportunityScore: 50,
      },
      {
        symbol: "MSFT",
        price: 400,
        aiScore: 90,
        aiReasoning: "Strong momentum",
        catalyst: null,
        signalType: "options_flow",
        stage: "CONFIRMED",
        opportunityScore: 70,
      },
    ]);
    mockValidatedTickerCount.mockResolvedValue(12);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.scanId).toBe("scan_1");
    expect(json.tickerCount).toBe(3);
    expect(json.totalAvailable).toBe(12);
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);

    // Verify query: all stages, aiScore >= 50, not P&D, includes aiReasoning
    const findManyCall = mockValidatedTickerFindMany.mock.calls[0][0];
    expect(findManyCall.where.stage).toEqual({ in: ["EARLY", "FORMING", "CONFIRMED"] });
    expect(findManyCall.where.aiScore).toEqual({ gte: 50 });
    expect(findManyCall.where.pndFlagged).toBe(false);
    expect(findManyCall.select.aiReasoning).toBe(true);

    // Verify stage priority: EARLY first, then FORMING, then CONFIRMED
    const alertTickers = mockSendTickerAlerts.mock.calls[0][0];
    expect(alertTickers[0].symbol).toBe("AAPL");   // EARLY (75)
    expect(alertTickers[1].symbol).toBe("PANW");    // FORMING (85)
    expect(alertTickers[2].symbol).toBe("MSFT");    // CONFIRMED (90)
    expect(alertTickers[0].aiReasoning).toBe("Multi-source convergence");
  });

  it("sends empty alert when no tickers qualify", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockValidatedTickerFindMany.mockResolvedValue([]);
    mockValidatedTickerCount.mockResolvedValue(5);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.tickerCount).toBe(0);
    expect(json.totalAvailable).toBe(5);
    expect(mockValidatedTickerFindMany).toHaveBeenCalledTimes(1);
    expect(mockSendTickerAlerts).toHaveBeenCalledWith([], 5);
  });
});
