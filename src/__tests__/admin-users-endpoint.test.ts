import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Prisma mocks ──────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

// ── Import under test ─────────────────────────────────────────────────────────

const { GET } = await import("@/app/api/admin/users/route");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_1",
    email: "alice@example.com",
    username: "alice",
    name: "Alice",
    role: "user",
    emailAlerts: true,
    createdAt: new Date("2025-01-15T10:00:00Z"),
    lastActiveAt: new Date("2026-04-10T09:00:00Z"),
    subscription: null,
    _count: { positions: 2, watchlist: 3, apiKeys: 1 },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth / permission checks ──────────────────────────────────────────────

  it("returns 403 when the requesting user is not an admin", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUnique.mockResolvedValue({ role: "user" });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the requesting user does not exist in DB", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_ghost");
    mockUserFindUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  // ── Ordering: lastActiveAt desc, nulls last (regression guard) ────────────

  it("orders users by lastActiveAt desc with nulls last", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([]);

    await GET();

    const call = mockUserFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ lastActiveAt: { sort: "desc", nulls: "last" } });
  });

  it("does NOT order users by createdAt (regression guard against old behavior)", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([]);

    await GET();

    const call = mockUserFindMany.mock.calls[0][0];
    expect(JSON.stringify(call.orderBy)).not.toContain("createdAt");
  });

  // ── Successful response shape ─────────────────────────────────────────────

  it("returns 200 with users array for admin users", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([
      makeDbUser({ id: "user_1", email: "alice@example.com", lastActiveAt: new Date("2026-04-10") }),
      makeDbUser({ id: "user_2", email: "bob@example.com", lastActiveAt: null }),
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(2);
    expect(json.users[0].email).toBe("alice@example.com");
    expect(json.users[1].email).toBe("bob@example.com");
  });

  it("selects the expected fields including lastActiveAt and subscription counts", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([]);

    await GET();

    const call = mockUserFindMany.mock.calls[0][0];
    expect(call.select.lastActiveAt).toBe(true);
    expect(call.select.createdAt).toBe(true);
    expect(call.select.email).toBe(true);
    expect(call.select._count).toEqual({
      select: { positions: true, watchlist: true, apiKeys: true },
    });
  });

  it("returns subscription details nested in each user", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([
      makeDbUser({
        subscription: { status: "ACTIVE", currentPeriodEnd: new Date("2027-01-01"), cancelAtPeriodEnd: false },
      }),
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users[0].subscription).toMatchObject({ status: "ACTIVE" });
  });

  // ── Empty result ──────────────────────────────────────────────────────────

  it("returns an empty users array when no users exist", async () => {
    mockGetCurrentUserId.mockResolvedValue("admin_1");
    mockUserFindUnique.mockResolvedValue({ role: "admin" });
    mockUserFindMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toEqual([]);
  });
});
