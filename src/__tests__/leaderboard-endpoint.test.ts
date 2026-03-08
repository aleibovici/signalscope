import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
const mockFindManyPositions = vi.fn();
const mockFindManySnapshots = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPosition: { findMany: (...args: unknown[]) => mockFindManyPositions(...args) },
    priceSnapshot: { findMany: (...args: unknown[]) => mockFindManySnapshots(...args) },
  },
}));

// Mock auth
const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const { GET, leaderboardCache } = await import("@/app/api/leaderboard/route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/leaderboard");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

function makePosition(
  userId: string,
  username: string,
  symbol: string,
  entryPrice: number,
  opts: {
    status?: "OPEN" | "CLOSED";
    closePrice?: number | null;
    openedAt?: Date;
    verified?: boolean;
  } = {}
) {
  return {
    id: `pos_${userId}_${symbol}`,
    userId,
    symbol,
    entryPrice,
    shares: 10,
    notes: null,
    status: opts.status ?? "OPEN",
    verified: opts.verified ?? true,
    closePrice: opts.closePrice ?? null,
    openedAt: opts.openedAt ?? daysAgo(1),
    closedAt: opts.status === "CLOSED" ? daysAgo(0) : null,
    createdAt: opts.openedAt ?? daysAgo(1),
    updatedAt: now,
    user: { id: userId, username },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  leaderboardCache.clear();
  mockGetCurrentUserId.mockResolvedValue("current_user");
  mockFindManyPositions.mockResolvedValue([]);
  mockFindManySnapshots.mockResolvedValue([]);
});

describe("GET /api/leaderboard", () => {
  it("returns empty result when no positions", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leaderboard).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.pricesAsOf).toBeNull();
  });

  it("returns correct response shape with all timeframe columns", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader_one", "AAPL", 100, {
        status: "CLOSED",
        closePrice: 110,
        openedAt: daysAgo(1),
      }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leaderboard).toHaveLength(1);
    const entry = body.leaderboard[0];
    expect(entry).toEqual({
      rank: 1,
      username: "trader_one",
      gain3d: 10,
      gain7d: 10,
      gain30d: 10,
      positionCount: 1,
      winRate: 1,
      bestSymbol: "AAPL",
      bestGainPct: 10,
      verifiedRate: 1,
    });
    expect(body.total).toBe(1);
  });

  it("shows null for timeframes where user has no positions", async () => {
    // Position opened 5 days ago — should appear in 7d and 30d but not 3d
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, {
        status: "CLOSED",
        closePrice: 120,
        openedAt: daysAgo(5),
      }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].gain3d).toBeNull();
    expect(body.leaderboard[0].gain7d).toBe(20);
    expect(body.leaderboard[0].gain30d).toBe(20);
  });

  it("computes different gains per timeframe window", async () => {
    // Recent position (1d ago) = +20%, older position (10d ago) = -10%
    // 3d window: only recent → +20%
    // 7d window: only recent → +20%
    // 30d window: both → avg(+20, -10) = +5%
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, {
        status: "CLOSED",
        closePrice: 120,
        openedAt: daysAgo(1),
      }),
      makePosition("u1", "trader", "NVDA", 100, {
        status: "CLOSED",
        closePrice: 90,
        openedAt: daysAgo(10),
      }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].gain3d).toBe(20);
    expect(body.leaderboard[0].gain7d).toBe(20);
    expect(body.leaderboard[0].gain30d).toBe(5);
  });

  it("excludes users without username", async () => {
    mockFindManyPositions.mockResolvedValue([]);
    await GET(makeRequest());

    expect(mockFindManyPositions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { username: { not: null } },
        }),
      })
    );
  });

  it("computes gain for CLOSED positions using closePrice", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader_one", "AAPL", 50, {
        status: "CLOSED",
        closePrice: 75,
      }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].gain30d).toBe(50); // (75-50)/50 * 100 = 50%
  });

  it("computes gain for OPEN positions using snapshot price", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader_one", "NVDA", 200),
    ]);
    mockFindManySnapshots.mockResolvedValue([
      { symbol: "NVDA", price: 240, createdAt: daysAgo(0) },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].gain7d).toBe(20); // (240-200)/200 * 100 = 20%
    expect(body.pricesAsOf).not.toBeNull();
  });

  it("excludes open positions with no snapshot", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader_one", "MYSTERY", 100),
    ]);
    mockFindManySnapshots.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("sorts by gain7d descending", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "loser", "AAPL", 100, { status: "CLOSED", closePrice: 90 }),
      makePosition("u2", "winner", "NVDA", 100, { status: "CLOSED", closePrice: 150 }),
      makePosition("u3", "mid", "TSLA", 100, { status: "CLOSED", closePrice: 120 }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard.map((e: { username: string }) => e.username)).toEqual([
      "winner",
      "mid",
      "loser",
    ]);
    expect(body.leaderboard[0].rank).toBe(1);
    expect(body.leaderboard[1].rank).toBe(2);
    expect(body.leaderboard[2].rank).toBe(3);
  });

  it("paginates correctly", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "alpha", "AAPL", 100, { status: "CLOSED", closePrice: 130 }),
      makePosition("u2", "beta", "NVDA", 100, { status: "CLOSED", closePrice: 120 }),
      makePosition("u3", "gamma", "TSLA", 100, { status: "CLOSED", closePrice: 110 }),
    ]);

    const res1 = await GET(makeRequest({ page: "1", limit: "2" }));
    const body1 = await res1.json();
    expect(body1.leaderboard).toHaveLength(2);
    expect(body1.total).toBe(3);
    expect(body1.leaderboard[0].rank).toBe(1);

    const res2 = await GET(makeRequest({ page: "2", limit: "2" }));
    const body2 = await res2.json();
    expect(body2.leaderboard).toHaveLength(1);
    expect(body2.leaderboard[0].rank).toBe(3);
  });

  it("computes win rate correctly", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, { status: "CLOSED", closePrice: 120 }),
      makePosition("u1", "trader", "NVDA", 100, { status: "CLOSED", closePrice: 80 }),
      makePosition("u1", "trader", "TSLA", 100, { status: "CLOSED", closePrice: 130 }),
      makePosition("u1", "trader", "AMD", 100, { status: "CLOSED", closePrice: 95 }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    // 2 wins (AAPL +20%, TSLA +30%) out of 4 = 0.5
    expect(body.leaderboard[0].winRate).toBe(0.5);
    expect(body.leaderboard[0].positionCount).toBe(4);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  it("tracks best symbol per user across all positions", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, { status: "CLOSED", closePrice: 110 }),
      makePosition("u1", "trader", "NVDA", 100, { status: "CLOSED", closePrice: 150 }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].bestSymbol).toBe("NVDA");
    expect(body.leaderboard[0].bestGainPct).toBe(50);
  });

  it("returns 500 on unexpected error", async () => {
    mockFindManyPositions.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("computes verifiedRate as ratio of verified positions", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, { status: "CLOSED", closePrice: 120, verified: true }),
      makePosition("u1", "trader", "NVDA", 100, { status: "CLOSED", closePrice: 110, verified: false }),
      makePosition("u1", "trader", "TSLA", 100, { status: "CLOSED", closePrice: 130, verified: true }),
      makePosition("u1", "trader", "AMD", 100, { status: "CLOSED", closePrice: 105, verified: false }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].verifiedRate).toBe(0.5); // 2 of 4 verified
  });

  it("shows verifiedRate 1 when all positions are verified", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, { status: "CLOSED", closePrice: 120, verified: true }),
      makePosition("u1", "trader", "NVDA", 100, { status: "CLOSED", closePrice: 110, verified: true }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].verifiedRate).toBe(1);
  });

  it("shows verifiedRate 0 when no positions are verified", async () => {
    mockFindManyPositions.mockResolvedValue([
      makePosition("u1", "trader", "AAPL", 100, { status: "CLOSED", closePrice: 120, verified: false }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.leaderboard[0].verifiedRate).toBe(0);
  });

  it("fetches positions within 30d window", async () => {
    await GET(makeRequest());

    expect(mockFindManyPositions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          openedAt: expect.objectContaining({ gte: expect.any(Date) }),
          entryPrice: { gt: 0 },
        }),
      })
    );
  });
});
