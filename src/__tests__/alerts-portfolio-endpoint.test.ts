import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockSendPortfolioAlerts = vi.fn();

vi.mock("@/lib/email", () => ({
  sendPortfolioAlerts: (...args: unknown[]) => mockSendPortfolioAlerts(...args),
}));

const { POST } = await import("@/app/api/alerts/portfolio/route");

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/alerts/portfolio", {
    method: "POST",
    headers,
  });
}

describe("POST /api/alerts/portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  });

  it("returns 401 when x-snapshot-key is missing", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
  });

  it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");

    const res = await POST(makeRequest({ "x-snapshot-key": "any-key" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("Endpoint not configured");
    expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
  });

  it("sends portfolio alerts with a valid snapshot key", async () => {
    mockSendPortfolioAlerts.mockResolvedValue({ usersNotified: 3, tickersMatched: 5 });

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      status: "sent",
      usersNotified: 3,
      tickersMatched: 5,
    });
    expect(mockSendPortfolioAlerts).toHaveBeenCalledTimes(1);
  });
});
