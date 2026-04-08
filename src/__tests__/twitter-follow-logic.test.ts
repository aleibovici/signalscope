/**
 * Tests for the ensureSeedAccounts unresolvable-seeding regression fix.
 *
 * Bug: old code queried { source: "seed" } so seeds previously marked
 * "unresolvable" were never found, causing a redundant API lookup on every
 * follow-job run. Fix: query by { username: { in: [...] } } so any existing
 * record for a seed (regardless of source) prevents re-lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Skip setTimeout delays inside follow.ts
const realSetTimeout = globalThis.setTimeout;
vi.stubGlobal(
  "setTimeout",
  (cb: (...args: unknown[]) => void, _ms?: number, ...args: unknown[]) =>
    realSetTimeout(cb, 0, ...args)
);

/* ── Prisma mock ─────────────────────────────────────────────────── */

const mockTwitterFollow = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
  upsert: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  count: vi.fn().mockResolvedValue(0),
};
const mockXApiLog = { findFirst: vi.fn() };
const mockScan = { findFirst: vi.fn() };
const mockSignal = { findMany: vi.fn().mockResolvedValue([]) };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    twitterFollow: mockTwitterFollow,
    xApiLog: mockXApiLog,
    scan: mockScan,
    signal: mockSignal,
  },
}));

/* ── Twitter post/log mocks ─────────────────────────────────────── */

vi.mock("@/lib/twitter/post", () => ({
  buildOAuthHeader: vi.fn().mockReturnValue("OAuth test"),
  getCredentials: vi.fn().mockReturnValue({
    apiKey: "key",
    apiSecret: "secret",
    accessToken: "token",
    accessTokenSecret: "token_secret",
  }),
}));

vi.mock("@/lib/twitter/log", () => ({ logXApiCall: vi.fn() }));

/* ── Import module under test ───────────────────────────────────── */

const { runFollowJob } = await import("@/lib/twitter/follow");

/* ── Minimal mock helper ────────────────────────────────────────── */

/**
 * Sets up the minimal DB mocks so runFollowJob reaches ensureSeedAccounts
 * and then completes without needing real credentials or API responses.
 *
 * Override specific mocks after calling this to tailor individual tests.
 */
function setupBaseMocks() {
  // getMyUserId: return a cached ID from xApiLog so no API call is needed
  mockXApiLog.findFirst.mockImplementation(
    (args: { where?: { action?: string; endpoint?: string } }) => {
      if (args?.where?.action === "followers") {
        // Recent timestamp → skip the follower-list fetch
        return Promise.resolve({ createdAt: new Date() });
      }
      if (args?.where?.endpoint === "users/me") {
        // Cached user ID
        return Promise.resolve({ responseBody: "user_99" });
      }
      return Promise.resolve(null);
    }
  );

  // discoverFromHarvest: no completed scan → discovery skipped entirely
  mockScan.findFirst.mockResolvedValue(null);
  mockSignal.findMany.mockResolvedValue([]);

  // processFollows / processUnfollows / updateFollowBacks queue: empty
  mockTwitterFollow.findMany.mockResolvedValue([]);
  mockTwitterFollow.findFirst.mockResolvedValue(null);
  mockTwitterFollow.count.mockResolvedValue(0);
}

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockTwitterFollow.create.mockResolvedValue({});
  mockTwitterFollow.upsert.mockResolvedValue({});
  mockTwitterFollow.update.mockResolvedValue({});
  mockTwitterFollow.count.mockResolvedValue(0);
});

describe("ensureSeedAccounts — unresolvable seeding regression", () => {
  it("does not call the X API when all seed usernames already exist in DB (any source)", async () => {
    setupBaseMocks();

    // Return a DB record for every seed account username — simulates seeds
    // previously marked "unresolvable" or already seeded successfully.
    // The fixed query checks by username regardless of source.
    mockTwitterFollow.findMany.mockImplementation(
      (args: { where?: { username?: { in?: string[] } } }) => {
        if (args?.where?.username?.in) {
          // All seeds present — return a stub record for each
          return Promise.resolve(
            args.where.username.in.map((u: string) => ({ username: u }))
          );
        }
        return Promise.resolve([]);
      }
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "user_99" } }), { status: 200 })
    );

    await runFollowJob();

    // lookupUserIds must NOT have been called — no /users/by request
    const lookupCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/2/users/by")
    );
    expect(lookupCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it("creates an unresolvable record when a seed username cannot be resolved via the X API", async () => {
    setupBaseMocks();

    // No seeds in DB yet
    mockTwitterFollow.findMany.mockResolvedValue([]);

    vi.stubEnv("X_BEARER_TOKEN", "test-bearer");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes("/2/users/me")) {
        // getMyUserId API call — should not be reached (cached from xApiLog)
        return Promise.resolve(
          new Response(JSON.stringify({ data: { id: "user_99" } }), { status: 200 })
        );
      }
      if (urlStr.includes("/2/users/by")) {
        // lookupUserIds returns an empty data array — none resolved
        return Promise.resolve(
          new Response(JSON.stringify({ data: [] }), { status: 200 })
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await runFollowJob();

    // Each create call receives a single { data: { ... } } argument.
    // At least one should have source: "unresolvable".
    const unresolvableCalls = mockTwitterFollow.create.mock.calls.filter(
      ([args]: [{ data?: { source?: string } }]) => args?.data?.source === "unresolvable"
    );
    expect(unresolvableCalls.length).toBeGreaterThan(0);

    // The twitterId for unresolvable records must use the "unresolvable_" prefix
    for (const [args] of unresolvableCalls as [{ data: { twitterId: string; username: string } }][]) {
      expect(args.data.twitterId).toMatch(/^unresolvable_/);
      expect(args.data.twitterId).toBe(`unresolvable_${args.data.username}`);
    }

    fetchSpy.mockRestore();
  });

  it("skips re-creating an unresolvable record if one already exists (unique-constraint swallowed)", async () => {
    setupBaseMocks();

    // Seeds not found by username query
    mockTwitterFollow.findMany.mockResolvedValue([]);
    vi.stubEnv("X_BEARER_TOKEN", "test-bearer");

    // lookupUserIds returns empty
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    // Simulate unique-constraint error on first create, success on subsequent
    mockTwitterFollow.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" })
    );

    // Should complete without throwing even when create is rejected
    await expect(runFollowJob()).resolves.toBeDefined();
  });
});

describe("processFollows — excludes unresolvable records from follow queue", () => {
  it("passes source: { not: 'unresolvable' } filter when fetching the follow queue", async () => {
    setupBaseMocks();

    // Seeds already in DB — no API lookup needed
    mockTwitterFollow.findMany.mockImplementation(
      (args: { where?: { username?: { in?: string[] }; followedAt?: unknown } }) => {
        if (args?.where?.username?.in) {
          return Promise.resolve(
            args.where.username.in.map((u: string) => ({ username: u }))
          );
        }
        return Promise.resolve([]);
      }
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "user_99" } }), { status: 200 })
    );

    await runFollowJob();

    // Find the findMany call that queries the follow queue
    const queueCall = mockTwitterFollow.findMany.mock.calls.find(
      ([args]: [{ where?: { source?: unknown } }]) =>
        args?.where?.source !== undefined
    ) as [{ where: { source: { not: string } } }] | undefined;

    expect(queueCall).toBeDefined();
    expect(queueCall![0].where.source).toEqual({ not: "unresolvable" });
  });
});
