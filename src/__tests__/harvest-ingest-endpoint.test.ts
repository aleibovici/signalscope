import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("HARVEST_API_KEY", "test-harvest-key");

// Mock processSignals
const mockProcessSignals = vi.fn();
vi.mock("@/lib/harvester", () => ({
  processSignals: (...args: unknown[]) => mockProcessSignals(...args),
}));

const { POST } = await import("@/app/api/harvest/ingest/route");

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/harvest/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  signals: [
    { symbol: "AAPL", source: "REDDIT", title: "AAPL to the moon" },
    { symbol: "TSLA", source: "TWITTER", body: "TSLA breakout" },
  ],
  harvestedAt: "2026-03-05T03:00:00.000Z",
};

describe("POST /api/harvest/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HARVEST_API_KEY", "test-harvest-key");
  });

  it("returns scanId on valid payload with correct key", async () => {
    mockProcessSignals.mockResolvedValue("scan_123");

    const res = await POST(makeRequest(validPayload, { "x-harvest-key": "test-harvest-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("completed");
    expect(json.scanId).toBe("scan_123");
    expect(mockProcessSignals).toHaveBeenCalledWith(validPayload.signals);
  });

  it("returns 401 when x-harvest-key is missing", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
    expect(mockProcessSignals).not.toHaveBeenCalled();
  });

  it("returns 401 when x-harvest-key is wrong", async () => {
    const res = await POST(makeRequest(validPayload, { "x-harvest-key": "wrong-key" }));
    expect(res.status).toBe(401);
    expect(mockProcessSignals).not.toHaveBeenCalled();
  });

  it("returns 503 when HARVEST_API_KEY env is not set", async () => {
    vi.stubEnv("HARVEST_API_KEY", "");

    const res = await POST(makeRequest(validPayload, { "x-harvest-key": "any-key" }));
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.error).toBe("Endpoint not configured");
  });

  it("returns 400 for empty signals array", async () => {
    const res = await POST(
      makeRequest({ signals: [], harvestedAt: "2026-03-05T03:00:00.000Z" }, { "x-harvest-key": "test-harvest-key" })
    );
    expect(res.status).toBe(400);
    expect(mockProcessSignals).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid harvestedAt format", async () => {
    const res = await POST(
      makeRequest(
        { signals: [{ symbol: "AAPL", source: "REDDIT" }], harvestedAt: "not-a-date" },
        { "x-harvest-key": "test-harvest-key" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid source enum", async () => {
    const res = await POST(
      makeRequest(
        { signals: [{ symbol: "AAPL", source: "TIKTOK" }], harvestedAt: "2026-03-05T03:00:00.000Z" },
        { "x-harvest-key": "test-harvest-key" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing symbol field", async () => {
    const res = await POST(
      makeRequest(
        { signals: [{ source: "REDDIT" }], harvestedAt: "2026-03-05T03:00:00.000Z" },
        { "x-harvest-key": "test-harvest-key" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when processSignals throws", async () => {
    mockProcessSignals.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest(validPayload, { "x-harvest-key": "test-harvest-key" }));
    expect(res.status).toBe(500);
  });

  it("accepts signals with all optional fields", async () => {
    mockProcessSignals.mockResolvedValue("scan_456");

    const fullSignal = {
      symbol: "GME",
      source: "REDDIT",
      title: "GME squeeze",
      body: "Short squeeze incoming",
      url: "https://reddit.com/r/wallstreetbets/123",
      author: "diamond_hands",
      authorAge: 365,
      authorKarma: 5000,
      upvotes: 1500,
      commentCount: 200,
      subreddit: "wallstreetbets",
      postAge: 2,
      sortType: "rising",
    };

    const res = await POST(
      makeRequest(
        { signals: [fullSignal], harvestedAt: "2026-03-05T03:00:00.000Z" },
        { "x-harvest-key": "test-harvest-key" }
      )
    );

    expect(res.status).toBe(200);
    expect(mockProcessSignals).toHaveBeenCalledWith([fullSignal]);
  });
});
