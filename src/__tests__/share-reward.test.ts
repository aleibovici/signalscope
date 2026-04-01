import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

const mockHasActiveSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  hasActiveSubscription: (...args: unknown[]) => mockHasActiveSubscription(...args),
}));

const mockUserFindUniqueOrThrow = vi.fn();
const mockUserUpdate = vi.fn();
const mockSubscriptionUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockUserFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    subscription: {
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
    },
  },
}));

const mockStripeCustomersCreate = vi.fn();
const mockStripeSubscriptionsCreate = vi.fn();
const mockStripeSubscriptionsList = vi.fn();
const mockStripeSubscriptionsUpdate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    customers: {
      create: (...args: unknown[]) => mockStripeCustomersCreate(...args),
    },
    subscriptions: {
      create: (...args: unknown[]) => mockStripeSubscriptionsCreate(...args),
      list: (...args: unknown[]) => mockStripeSubscriptionsList(...args),
      update: (...args: unknown[]) => mockStripeSubscriptionsUpdate(...args),
    },
  }),
  PRICE_IDS: { monthly: "price_monthly", yearly: "price_yearly" },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// ── Pure functions ─────────────────────────────────────────────────────────

describe("extractTweetId", () => {
  let extractTweetId: (typeof import("@/lib/share-reward"))["extractTweetId"];

  beforeEach(async () => {
    vi.resetModules();
    ({ extractTweetId } = await import("@/lib/share-reward"));
  });

  it("parses x.com status URL", () => {
    expect(extractTweetId("https://x.com/user/status/1234567890")).toBe("1234567890");
  });

  it("parses twitter.com status URL", () => {
    expect(extractTweetId("https://twitter.com/signalscopes/status/9999")).toBe("9999");
  });

  it("returns null for non-tweet URL", () => {
    expect(extractTweetId("https://example.com/foo")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTweetId("")).toBeNull();
  });

  it("returns null for x.com profile (no status segment)", () => {
    expect(extractTweetId("https://x.com/signalscopes")).toBeNull();
  });
});

describe("buildTweetIntentUrl", () => {
  let buildTweetIntentUrl: (typeof import("@/lib/share-reward"))["buildTweetIntentUrl"];

  beforeEach(async () => {
    vi.resetModules();
    ({ buildTweetIntentUrl } = await import("@/lib/share-reward"));
  });

  it("returns a twitter intent URL", () => {
    const url = buildTweetIntentUrl();
    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  });

  it("encodes signalscopes mention in the URL", () => {
    const url = buildTweetIntentUrl();
    expect(decodeURIComponent(url)).toContain("@signalscopes");
  });

  it("encodes signalscopes.com link in the URL", () => {
    const url = buildTweetIntentUrl();
    expect(decodeURIComponent(url)).toContain("signalscopes.com");
  });
});

// ── verifyTweet ────────────────────────────────────────────────────────────

describe("verifyTweet", () => {
  let verifyTweet: (typeof import("@/lib/share-reward"))["verifyTweet"];

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("X_BEARER_TOKEN", "test-bearer-token");
    ({ verifyTweet } = await import("@/lib/share-reward"));
  });

  it("returns true when tweet text mentions signalscope", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "I use SignalScope to find stocks!" } }),
    });

    expect(await verifyTweet("123")).toBe(true);
  });

  it("is case-insensitive for signalscope mention", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "check out SIGNALSCOPE #stocks" } }),
    });

    expect(await verifyTweet("123")).toBe(true);
  });

  it("returns false when tweet text does not mention signalscope", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "Just a random tweet about stocks" } }),
    });

    expect(await verifyTweet("123")).toBe(false);
  });

  it("returns false when X API returns non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    expect(await verifyTweet("123")).toBe(false);
  });

  it("throws when X_BEARER_TOKEN is not set", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    const { verifyTweet: vt } = await import("@/lib/share-reward");

    await expect(vt("123")).rejects.toThrow("X_BEARER_TOKEN not configured");
  });

  it("calls the correct X API endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "signalscope" } }),
    });

    await verifyTweet("987654321");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.x.com/2/tweets/987654321?tweet.fields=text",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-bearer-token" },
      })
    );
  });
});

// ── claimShareReward ───────────────────────────────────────────────────────

describe("claimShareReward", () => {
  let claimShareReward: (typeof import("@/lib/share-reward"))["claimShareReward"];
  let ClaimError: (typeof import("@/lib/share-reward"))["ClaimError"];

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("X_BEARER_TOKEN", "test-bearer-token");
    ({ claimShareReward, ClaimError } = await import("@/lib/share-reward"));
  });

  const validTweetUrl = "https://x.com/user/status/1234567890";

  function mockVerifiedTweet() {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "I use SignalScope" } }),
    });
  }

  it("throws ClaimError(400) when reward already claimed", async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({
      shareRewardClaimedAt: new Date("2026-01-01"),
    });

    await expect(claimShareReward("user_1", validTweetUrl)).rejects.toThrow(ClaimError);
    await expect(claimShareReward("user_1", validTweetUrl)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("already claimed"),
    });
  });

  it("throws ClaimError(400) for invalid tweet URL", async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({ shareRewardClaimedAt: null });

    await expect(
      claimShareReward("user_1", "https://example.com/not-a-tweet")
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Invalid tweet URL") });
  });

  it("throws ClaimError(400) when tweet does not mention SignalScope", async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({ shareRewardClaimedAt: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "Just a random tweet" } }),
    });

    await expect(claimShareReward("user_1", validTweetUrl)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Tweet not found"),
    });
  });

  it("returns rewardType=trial for free user and creates trial subscription", async () => {
    mockUserFindUniqueOrThrow
      .mockResolvedValueOnce({ shareRewardClaimedAt: null }) // one-time gate check
      .mockResolvedValueOnce({ email: "free@example.com", stripeCustomerId: "cus_existing" }); // ensureStripeCustomer
    mockVerifiedTweet();
    mockHasActiveSubscription.mockResolvedValue(false);
    mockStripeSubscriptionsCreate.mockResolvedValue({
      id: "sub_trial",
      items: {
        data: [
          {
            price: { id: "price_monthly" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    mockSubscriptionUpsert.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const result = await claimShareReward("user_free", validTweetUrl);

    expect(result.rewardType).toBe("trial");
    expect(mockStripeSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: expect.objectContaining({ source: "share_reward" }),
      })
    );
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shareRewardClaimedAt: expect.any(Date) }) })
    );
  });

  it("returns rewardType=credit for Pro user and applies coupon to subscription", async () => {
    mockUserFindUniqueOrThrow
      .mockResolvedValueOnce({ shareRewardClaimedAt: null })
      .mockResolvedValueOnce({ email: "pro@example.com", stripeCustomerId: "cus_pro" });
    mockVerifiedTweet();
    mockHasActiveSubscription.mockResolvedValue(true);
    mockStripeSubscriptionsList.mockResolvedValue({ data: [{ id: "sub_pro" }] });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const result = await claimShareReward("user_pro", validTweetUrl);

    expect(result.rewardType).toBe("credit");
    expect(mockStripeSubscriptionsList).toHaveBeenCalledWith({
      customer: "cus_pro",
      status: "active",
      limit: 1,
    });
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_pro", {
      discounts: [{ coupon: "ohIkuVIp" }],
    });
    expect(mockStripeSubscriptionsCreate).not.toHaveBeenCalled();
  });

  it("creates Stripe customer if none exists for free user", async () => {
    mockUserFindUniqueOrThrow
      .mockResolvedValueOnce({ shareRewardClaimedAt: null })
      .mockResolvedValueOnce({ email: "new@example.com", stripeCustomerId: null }); // no customer yet
    mockVerifiedTweet();
    mockHasActiveSubscription.mockResolvedValue(false);
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockUserUpdate.mockResolvedValueOnce({}).mockResolvedValueOnce({}); // customer save + claimedAt
    mockStripeSubscriptionsCreate.mockResolvedValue({
      id: "sub_trial",
      items: {
        data: [
          {
            price: { id: "price_monthly" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    mockSubscriptionUpsert.mockResolvedValue({});

    await claimShareReward("user_new", validTweetUrl);

    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: "new@example.com",
      metadata: { userId: "user_new" },
    });
  });
});

// ── GET /api/user/share-reward ─────────────────────────────────────────────

describe("GET /api/user/share-reward", () => {
  let GET: (typeof import("@/app/api/user/share-reward/route"))["GET"];

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("X_BEARER_TOKEN", "test-bearer-token");
    ({ GET } = await import("@/app/api/user/share-reward/route"));
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns unclaimed status with tweetIntentUrl and hasActiveSubscription", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({ shareRewardClaimedAt: null });
    mockHasActiveSubscription.mockResolvedValue(false);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(false);
    expect(body.claimedAt).toBeNull();
    expect(body.tweetIntentUrl).toMatch(/twitter\.com\/intent\/tweet/);
    expect(body.hasActiveSubscription).toBe(false);
  });

  it("returns claimed=true with claimedAt when reward was claimed", async () => {
    const claimedAt = new Date("2026-03-15T10:00:00Z");
    mockGetCurrentUserId.mockResolvedValue("user_1");
    mockUserFindUniqueOrThrow.mockResolvedValue({ shareRewardClaimedAt: claimedAt });
    mockHasActiveSubscription.mockResolvedValue(true);

    const res = await GET();
    const body = await res.json();
    expect(body.claimed).toBe(true);
    expect(body.claimedAt).toBe(claimedAt.toISOString());
    expect(body.hasActiveSubscription).toBe(true);
  });
});

// ── POST /api/user/share-reward ────────────────────────────────────────────

describe("POST /api/user/share-reward", () => {
  let POST: (typeof import("@/app/api/user/share-reward/route"))["POST"];

  function makeRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/user/share-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("X_BEARER_TOKEN", "test-bearer-token");
    ({ POST } = await import("@/app/api/user/share-reward/route"));
  });

  it("returns 503 when X_BEARER_TOKEN is not set", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    ({ POST } = await import("@/app/api/user/share-reward/route"));
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await POST(makeRequest({ tweetUrl: "https://x.com/u/status/1" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

    const res = await POST(makeRequest({ tweetUrl: "https://x.com/u/status/1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing tweetUrl", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid tweet URL");
  });

  it("returns 400 for non-URL tweetUrl", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");

    const res = await POST(makeRequest({ tweetUrl: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with ClaimError message when already claimed", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_1");
    // claimShareReward will throw ClaimError — mock via prisma user lookup
    mockUserFindUniqueOrThrow.mockResolvedValue({
      shareRewardClaimedAt: new Date("2026-01-01"),
    });

    const res = await POST(makeRequest({ tweetUrl: "https://x.com/user/status/123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already claimed");
  });

  it("returns 200 with rewardType on success", async () => {
    mockGetCurrentUserId.mockResolvedValue("user_pro");
    mockUserFindUniqueOrThrow
      .mockResolvedValueOnce({ shareRewardClaimedAt: null })
      .mockResolvedValueOnce({ email: "pro@example.com", stripeCustomerId: "cus_pro" });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { text: "I love SignalScope" } }),
    });
    mockHasActiveSubscription.mockResolvedValue(true);
    mockStripeSubscriptionsList.mockResolvedValue({ data: [{ id: "sub_pro" }] });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const res = await POST(makeRequest({ tweetUrl: "https://x.com/user/status/123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rewardType).toBe("credit");
  });
});
