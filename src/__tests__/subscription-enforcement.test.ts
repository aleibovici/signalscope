import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── API Key Generation Gate ────────────────────────────────────────────────

describe("POST /api/user/api-key — key generation", () => {
  let POST: (typeof import("@/app/api/user/api-key/route"))["POST"];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/user/api-key/route");
    POST = mod.POST;
  });

  it("allows key generation for free users (no subscription required)", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_free");
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockCreate.mockResolvedValue({});

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^sk_sig_/);
  });

  it("allows key generation when user has active subscription", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_pro");
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockCreate.mockResolvedValue({});

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^sk_sig_/);
  });

  it("GET returns api key metadata without subscription check", async () => {
    vi.resetModules();
    const mod = await import("@/app/api/user/api-key/route");
    mockGetCurrentUserId.mockResolvedValue("user_free");
    mockFindFirst.mockResolvedValue({
      prefix: "sk_sig_abcd...",
      createdAt: new Date(),
      lastUsedAt: null,
    });

    const res = await mod.GET();
    expect(res.status).toBe(200);
  });
});

// ── API Key Rate Limit (429) ───────────────────────────────────────────────

describe("handleApiError — rate limit mapping", () => {
  let handleApiError: (typeof import("@/lib/api-error"))["handleApiError"];

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("next/server", () => ({
      NextResponse: {
        json: vi.fn((body: unknown, init?: { status?: number }) => ({
          body,
          status: init?.status ?? 200,
          json: async () => body,
        })),
      },
    }));
    const mod = await import("@/lib/api-error");
    handleApiError = mod.handleApiError;
  });

  it("returns 429 for API key rate limit exceeded error", () => {
    const err = new Error("API key rate limit exceeded (1,000 requests/day)");
    const res = handleApiError(err, "test") as unknown as { status: number; body: { error: string } };
    expect(res.status).toBe(429);
    expect(res.body.error).toContain("rate limit");
  });

  it("returns 429 for monthly rate limit error when billing is enabled", () => {
    const err = new Error(
      "API key rate limit exceeded: 10 calls per calendar month (resets on the 1st)."
    );
    const res = handleApiError(err, "test") as unknown as { status: number; body: { error: string } };
    expect(res.status).toBe(429);
    expect(res.body.error).toContain("rate limit");
  });

  it("does not return 429 for unrelated errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("Something else");
    const res = handleApiError(err, "test") as { status: number };
    expect(res.status).toBe(500);
  });
});

// ── isApiKeyRateLimited ────────────────────────────────────────────────────

describe("isApiKeyRateLimited", () => {
  let isApiKeyRateLimited: (typeof import("@/lib/rate-limit"))["isApiKeyRateLimited"];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    isApiKeyRateLimited = mod.isApiKeyRateLimited;
  });

  it("returns false for first request", () => {
    expect(isApiKeyRateLimited("user_new")).toBe(false);
  });

  it("returns false within limit", () => {
    for (let i = 0; i < 999; i++) {
      isApiKeyRateLimited("user_within");
    }
    expect(isApiKeyRateLimited("user_within")).toBe(false);
  });

  it("returns true after 1000 requests", () => {
    for (let i = 0; i < 1000; i++) {
      isApiKeyRateLimited("user_over");
    }
    expect(isApiKeyRateLimited("user_over")).toBe(true);
  });
});

// ── checkAndIncrementFreeApiKey ────────────────────────────────────────────

describe("checkAndIncrementFreeApiKey", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockUpdateMany.mockReset();
  });

  it("returns allowed: true when increment succeeds (count < limit)", async () => {
    // Step 1 reset: no rows reset (window is current month)
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    // Step 2 gate: increment succeeded (1 row updated)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const mod = await import("@/lib/rate-limit");
    const { allowed } = await mod.checkAndIncrementFreeApiKey("key_1");
    expect(allowed).toBe(true);
  });

  it("returns allowed: false when at limit (count >= 10, gate returns 0)", async () => {
    // Step 1 reset: no rows reset
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    // Step 2 gate: 0 rows updated = already at limit
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const mod = await import("@/lib/rate-limit");
    const { allowed } = await mod.checkAndIncrementFreeApiKey("key_1");
    expect(allowed).toBe(false);
  });

  it("resets window when monthlyWindowStart is in prior month", async () => {
    // Step 1 reset: 1 row reset (prior month detected)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    // Step 2 gate: increment succeeds
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const mod = await import("@/lib/rate-limit");
    const { allowed } = await mod.checkAndIncrementFreeApiKey("key_1");
    expect(allowed).toBe(true);
    // Verify step 1 was called with monthlyWindowStart lt filter
    expect(mockUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ monthlyWindowStart: expect.objectContaining({ lt: expect.any(Date) }) }),
      data: expect.objectContaining({ monthlyCallCount: 0 }),
    }));
  });
});
