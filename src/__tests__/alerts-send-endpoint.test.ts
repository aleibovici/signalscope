import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockScanFindFirst = vi.fn();
const mockTickerFindMany = vi.fn();
const mockSendTickerAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: { findFirst: (...args: unknown[]) => mockScanFindFirst(...args) },
    validatedTicker: { findMany: (...args: unknown[]) => mockTickerFindMany(...args) },
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

  it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");

    const res = await POST(makeRequest({ "x-snapshot-key": "any-key" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("Endpoint not configured");
    expect(mockScanFindFirst).not.toHaveBeenCalled();
  });

  it("sends alerts with a valid snapshot key", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
    mockTickerFindMany.mockResolvedValue([
      {
        symbol: "ABC",
        price: 12.34,
        aiScore: 80,
        catalyst: "Catalyst",
        signalType: "multi_source",
        stage: "EARLY",
        opportunityScore: 90,
      },
    ]);
    mockSendTickerAlerts.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("sent");
    expect(json.scanId).toBe("scan_1");
    expect(json.tickerCount).toBe(1);
    expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);
  });
});
