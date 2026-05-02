import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();
const mockHasActiveSubscription = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

vi.mock("@/lib/subscription", () => ({
  hasActiveSubscription: (...args: unknown[]) => mockHasActiveSubscription(...args),
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

describe("POST /api/user/api-key — subscription gate", () => {
  let POST: (typeof import("@/app/api/user/api-key/route"))["POST"];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/user/api-key/route");
    POST = mod.POST;
  });

  it("returns 403 when user has no subscription", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_free");
    mockHasActiveSubscription.mockResolvedValue(false);

    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("subscription");
  });

  it("allows key generation when user has active subscription", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_pro");
    mockHasActiveSubscription.mockResolvedValue(true);
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
    // No subscription check needed for GET
    expect(mockHasActiveSubscription).not.toHaveBeenCalled();
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
