/**
 * Tests for POST /api/tweets/post
 *
 * Key regression covered: the route must call selectDiversifiedTickers with
 * limit=5 (not 10). This was reduced as part of a ~70% X API credit
 * optimisation (commit 5d55dc0). Regressing to 10 would double tweet-thread
 * API consumption.
 *
 * Coverage:
 *  - Auth: missing key → 401, wrong key → 401, missing env → 503
 *  - Early exits: no completed scan → no_scan, no tickers with reports → no_tickers
 *  - Batch size: selectDiversifiedTickers must receive limit=5
 *  - Response shape: tweeted vs failed based on tweetTickerBatch result
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/* ── Prisma mock ─────────────────────────────────────────────────── */

const mockScanFindFirst = vi.fn();
const mockTickerFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: { findFirst: (...args: unknown[]) => mockScanFindFirst(...args) },
    validatedTicker: { findMany: (...args: unknown[]) => mockTickerFindMany(...args) },
  },
}));

/* ── twitter/post mock ───────────────────────────────────────────── */

const mockSelectDiversifiedTickers = vi.fn();
const mockTweetTickerBatch = vi.fn();

vi.mock("@/lib/twitter/post", () => ({
  selectDiversifiedTickers: (...args: unknown[]) => mockSelectDiversifiedTickers(...args),
  tweetTickerBatch: (...args: unknown[]) => mockTweetTickerBatch(...args),
}));

/* ── Import route under test ─────────────────────────────────────── */

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const { POST } = await import("@/app/api/tweets/post/route");

/* ── Helpers ─────────────────────────────────────────────────────── */

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/tweets/post", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const VALID_KEY = { "x-snapshot-key": "test-snapshot-key" };

const TICKER_ROW = {
  symbol: "AAPL",
  recommendation: "Buy",
  catalyst: "Insider buying cluster",
  risks: "Valuation risk",
  aiReasoning: "Multiple C-suite purchases",
  stage: "EARLY",
  opportunityScore: 85,
  aiScore: 78,
  price: 150,
  marketCap: 2_500_000_000,
  sector: "Technology",
  sourceCount: 3,
};

const BATCH_RESULT = { posted: ["AAPL"], failed: [], replies: [], replyFailed: [] };

/* ── Setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  mockSelectDiversifiedTickers.mockReturnValue([TICKER_ROW]);
  mockTweetTickerBatch.mockResolvedValue(BATCH_RESULT);
});

/* ── Auth ────────────────────────────────────────────────────────── */

describe("POST /api/tweets/post — auth", () => {
  it("returns 503 when SNAPSHOT_API_KEY env is not set", async () => {
    vi.stubEnv("SNAPSHOT_API_KEY", "");
    const res = await POST(makeRequest({ "x-snapshot-key": "any" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Endpoint not configured");
  });

  it("returns 401 when x-snapshot-key header is missing", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-snapshot-key header is wrong", async () => {
    const res = await POST(makeRequest({ "x-snapshot-key": "wrong-key" }));
    expect(res.status).toBe(401);
  });
});

/* ── Early exits ─────────────────────────────────────────────────── */

describe("POST /api/tweets/post — early exits", () => {
  it("returns no_scan when no completed scan exists", async () => {
    mockScanFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_KEY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("no_scan");
    expect(mockTickerFindMany).not.toHaveBeenCalled();
  });

  it("returns no_tickers when the latest scan has no tickers with reports", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan-1", status: "COMPLETED" });
    mockTickerFindMany.mockResolvedValue([]);

    const res = await POST(makeRequest(VALID_KEY));
    const json = await res.json();

    expect(json.status).toBe("no_tickers");
    expect(mockSelectDiversifiedTickers).not.toHaveBeenCalled();
  });
});

/* ── Batch size ──────────────────────────────────────────────────── */

describe("POST /api/tweets/post — batch size", () => {
  /**
   * Regression guard: the route previously called selectDiversifiedTickers(details, 10).
   * Commit 5d55dc0 reduced this to 5 to cut X API credit usage ~70%.
   * This test fails if the limit is changed back to 10 or any other value.
   */
  it("calls selectDiversifiedTickers with limit=5", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan-1" });
    mockTickerFindMany.mockResolvedValue([TICKER_ROW]);

    await POST(makeRequest(VALID_KEY));

    expect(mockSelectDiversifiedTickers).toHaveBeenCalledOnce();
    const [, limit] = mockSelectDiversifiedTickers.mock.calls[0] as [unknown, number];
    expect(limit).toBe(5);
  });

  it("does not call selectDiversifiedTickers with the old limit of 10", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan-1" });
    mockTickerFindMany.mockResolvedValue([TICKER_ROW]);

    await POST(makeRequest(VALID_KEY));

    const [, limit] = mockSelectDiversifiedTickers.mock.calls[0] as [unknown, number];
    expect(limit).not.toBe(10);
  });
});

/* ── Response shape ──────────────────────────────────────────────── */

describe("POST /api/tweets/post — response shape", () => {
  it("returns status=tweeted when tweetTickerBatch posts successfully", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan-1" });
    mockTickerFindMany.mockResolvedValue([TICKER_ROW]);
    mockTweetTickerBatch.mockResolvedValue({
      posted: ["AAPL"],
      failed: [],
      replies: ["MSFT"],
      replyFailed: [],
    });

    const res = await POST(makeRequest(VALID_KEY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("tweeted");
    expect(json.posted).toEqual(["AAPL"]);
    expect(json.replies).toEqual(["MSFT"]);
  });

  it("returns status=failed when tweetTickerBatch posts nothing", async () => {
    mockScanFindFirst.mockResolvedValue({ id: "scan-1" });
    mockTickerFindMany.mockResolvedValue([TICKER_ROW]);
    mockTweetTickerBatch.mockResolvedValue({
      posted: [],
      failed: ["AAPL"],
      replies: [],
      replyFailed: [],
    });

    const res = await POST(makeRequest(VALID_KEY));
    const json = await res.json();

    expect(json.status).toBe("failed");
    expect(json.failed).toEqual(["AAPL"]);
  });
});
