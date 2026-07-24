/**
 * Tests for the ET-hour → slot derivation logic in POST /api/tweets/promo.
 *
 * The route derives a slot (0, 1, or 2) from the current New York time so a
 * single scheduled job can drive three distinct daily topics without
 * needing a body param.  An explicit body `{ slot }` still overrides the
 * derived value for manual runs.
 *
 * Coverage:
 *  - slotFromEtHour() mapping: 10→0, 14→1, 18→2, any other hour→0
 *  - Body slot overrides the derived value (valid values 0–2)
 *  - Invalid / out-of-range body slot is ignored (derived slot used instead)
 *  - Auth checks (missing key → 401, missing env → 503)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Prisma mock ────────────────────────────────────────────────────────────────
const mockScanCount = vi.fn();
const mockTickerCount = vi.fn();
const mockScanFindFirst = vi.fn();
const mockTickerGroupBy = vi.fn();
const mockSignalCount = vi.fn();
const mockSignalGroupBy = vi.fn();
const mockTickerFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      count: (...args: unknown[]) => mockScanCount(...args),
      findFirst: (...args: unknown[]) => mockScanFindFirst(...args),
    },
    validatedTicker: {
      count: (...args: unknown[]) => mockTickerCount(...args),
      groupBy: (...args: unknown[]) => mockTickerGroupBy(...args),
      findMany: (...args: unknown[]) => mockTickerFindMany(...args),
    },
    signal: {
      count: (...args: unknown[]) => mockSignalCount(...args),
      groupBy: (...args: unknown[]) => mockSignalGroupBy(...args),
    },
  },
}));

// ── promo lib mock ─────────────────────────────────────────────────────────────
const mockGenerateAndPostPromoTweet = vi.fn();

vi.mock("@/lib/twitter/promo", () => ({
  generateAndPostPromoTweet: (...args: unknown[]) =>
    mockGenerateAndPostPromoTweet(...args),
}));

// ── helpers ────────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}, body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/tweets/promo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function stubHappyPath() {
  mockScanCount.mockResolvedValue(100);
  mockTickerCount.mockResolvedValue(500);
  mockScanFindFirst.mockResolvedValue(null); // no latest scan — skips inner queries
  mockGenerateAndPostPromoTweet.mockResolvedValue({
    topic: { id: "multi-source", angle: "test", path: "/dashboard" },
    tweet: "test tweet",
    url: null,
    postResult: { success: true, tweetId: "123" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// ── Auth checks ────────────────────────────────────────────────────────────────

describe("POST /api/tweets/promo — auth", () => {
  it("returns 503 when SNAPSHOT_API_KEY env is not set", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    const res = await POST(makeRequest({ "x-snapshot-key": "anything" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when x-snapshot-key header is missing", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-snapshot-key header is wrong", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));
    expect(res.status).toBe(401);
  });
});

// ── slotFromEtHour derivation ──────────────────────────────────────────────────

describe("POST /api/tweets/promo — ET-hour slot derivation", () => {
  /**
   * Pin the clock to a specific UTC time corresponding to the given New York
   * hour, then call the route without a body slot override, and verify that
   * generateAndPostPromoTweet was called with the expected slot.
   *
   * America/New_York is UTC-4 in summer (EDT) and UTC-5 in winter (EST).
   * We use summer dates (April) where UTC-4 applies.
   * ET 10 AM = UTC 14:00, ET 14 PM = UTC 18:00, ET 18 PM = UTC 22:00.
   */

  async function callRouteAtUtcHour(utcHour: number): Promise<number> {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    // Pin Date to a fixed UTC time (summer, EDT = UTC-4)
    const fixedDate = new Date(`2026-04-03T${String(utcHour).padStart(2, "0")}:00:00.000Z`);
    vi.setSystemTime(fixedDate);

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    expect(res.status).toBe(200);

    // Return the slot that was passed to generateAndPostPromoTweet
    return mockGenerateAndPostPromoTweet.mock.calls[0][0] as number;
  }

  it("derives slot 0 at ET 10 AM (UTC 14:00)", async () => {
    const slot = await callRouteAtUtcHour(14);
    expect(slot).toBe(0);
  });

  it("derives slot 1 at ET 14 PM (UTC 18:00)", async () => {
    const slot = await callRouteAtUtcHour(18);
    expect(slot).toBe(1);
  });

  it("derives slot 2 at ET 18 PM (UTC 22:00)", async () => {
    const slot = await callRouteAtUtcHour(22);
    expect(slot).toBe(2);
  });

  it("falls back to slot 0 for an unrecognised hour (ET 9 AM = UTC 13:00)", async () => {
    const slot = await callRouteAtUtcHour(13);
    expect(slot).toBe(0);
  });

  it("falls back to slot 0 at midnight ET (UTC 04:00)", async () => {
    const slot = await callRouteAtUtcHour(4);
    expect(slot).toBe(0);
  });
});

// ── Body slot override ─────────────────────────────────────────────────────────

describe("POST /api/tweets/promo — body slot override", () => {
  it("uses body slot 1 even when ET hour would produce slot 0", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    // Pin to ET 10 AM (normally → slot 0)
    vi.setSystemTime(new Date("2026-04-03T14:00:00.000Z"));

    const res = await POST(
      makeRequest({ "x-snapshot-key": "test-snapshot-key" }, { slot: 1 })
    );
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(1);
  });

  it("uses body slot 2 even when ET hour would produce slot 0", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    vi.setSystemTime(new Date("2026-04-03T14:00:00.000Z")); // ET 10 AM → slot 0

    const res = await POST(
      makeRequest({ "x-snapshot-key": "test-snapshot-key" }, { slot: 2 })
    );
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(2);
  });

  it("ignores body slot 3 (out of range) and falls back to derived slot", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    // ET 14 PM (UTC 18) → derived slot 1
    vi.setSystemTime(new Date("2026-04-03T18:00:00.000Z"));

    const res = await POST(
      makeRequest({ "x-snapshot-key": "test-snapshot-key" }, { slot: 3 })
    );
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(1); // derived, not 3
  });

  it("ignores body slot -1 (negative) and falls back to derived slot", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    vi.setSystemTime(new Date("2026-04-03T22:00:00.000Z")); // ET 18 → derived slot 2

    const res = await POST(
      makeRequest({ "x-snapshot-key": "test-snapshot-key" }, { slot: -1 })
    );
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(2); // derived, not -1
  });

  it("ignores non-number body slot (string) and falls back to derived slot", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    vi.setSystemTime(new Date("2026-04-03T14:00:00.000Z")); // ET 10 → derived slot 0

    const res = await POST(
      makeRequest({ "x-snapshot-key": "test-snapshot-key" }, { slot: "1" })
    );
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(0); // derived
  });

  it("handles missing body gracefully and uses derived slot", async () => {
    stubHappyPath();
    vi.resetModules();
    const { POST } = await import("@/app/api/tweets/promo/route");

    vi.setSystemTime(new Date("2026-04-03T18:00:00.000Z")); // ET 14 → slot 1

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    expect(res.status).toBe(200);

    const slotArg = mockGenerateAndPostPromoTweet.mock.calls[0][0];
    expect(slotArg).toBe(1);
  });
});

// ── Response shape ─────────────────────────────────────────────────────────────

describe("POST /api/tweets/promo — response shape", () => {
  it("returns status=tweeted when postResult.success is true", async () => {
    stubHappyPath();
    vi.resetModules();
    vi.setSystemTime(new Date("2026-04-03T14:00:00.000Z"));
    const { POST } = await import("@/app/api/tweets/promo/route");

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(json.status).toBe("tweeted");
    expect(json.tweetId).toBe("123");
    expect(json).toHaveProperty("topic");
    expect(json).toHaveProperty("tweet");
  });

  it("returns status=failed when postResult.success is false", async () => {
    mockScanCount.mockResolvedValue(10);
    mockTickerCount.mockResolvedValue(50);
    mockScanFindFirst.mockResolvedValue(null);
    mockGenerateAndPostPromoTweet.mockResolvedValue({
      topic: { id: "pnd-filter", angle: "test", path: "/methodology" },
      tweet: "test",
      url: null,
      postResult: { success: false, error: "Rate limit" },
    });

    vi.resetModules();
    vi.setSystemTime(new Date("2026-04-03T14:00:00.000Z"));
    const { POST } = await import("@/app/api/tweets/promo/route");

    const res = await POST(makeRequest({ "x-snapshot-key": "test-snapshot-key" }));
    const json = await res.json();

    expect(json.status).toBe("failed");
    expect(json.error).toBe("Rate limit");
  });
});
