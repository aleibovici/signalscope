import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockRunFollowJob = vi.fn();
vi.mock("@/lib/twitter/follow", () => ({
  runFollowJob: (...args: unknown[]) => mockRunFollowJob(...args),
}));

const { POST } = await import("@/app/api/twitter/follow/route");

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/twitter/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("POST /api/twitter/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  });

  it("returns 401 when x-snapshot-key is missing", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockRunFollowJob).not.toHaveBeenCalled();
  });

  it("returns 401 when x-snapshot-key is wrong", async () => {
    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));
    expect(res.status).toBe(401);
    expect(mockRunFollowJob).not.toHaveBeenCalled();
  });

  it("returns 503 when SNAPSHOT_API_KEY env is not set", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");
    const res = await POST(makeRequest({ "x-snapshot-key": "any-key" }));
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toBe("Endpoint not configured");
    expect(mockRunFollowJob).not.toHaveBeenCalled();
  });

  it("returns 200 with job result spread into response", async () => {
    const jobResult = {
      discovered: 2,
      seeded: 1,
      followed: ["trader_a", "trader_b"],
      followErrors: [],
      unfollowed: ["stale_acct"],
      unfollowErrors: [],
      followBacksUpdated: 0,
      queueSize: 5,
    };
    mockRunFollowJob.mockResolvedValue(jobResult);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.followed).toEqual(["trader_a", "trader_b"]);
    expect(json.seeded).toBe(1);
    expect(json.queueSize).toBe(5);
    expect(json.unfollowed).toEqual(["stale_acct"]);
    expect(mockRunFollowJob).toHaveBeenCalledOnce();
  });

  it("returns 500 when runFollowJob throws", async () => {
    mockRunFollowJob.mockRejectedValue(new Error("Twitter credentials not configured"));
    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    expect(res.status).toBe(500);
  });
});
