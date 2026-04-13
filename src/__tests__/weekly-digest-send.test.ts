import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted runs before vi.mock factories and module imports.
// We use it to (a) set RESEND_API_KEY so the module-level `new Resend(...)` is
// not skipped, and (b) create mock functions that are accessible inside vi.mock
// factories (plain `const mockFn = vi.fn()` is NOT accessible there).
const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  return {
    batchSend: vi.fn(),
    scanFindFirst: vi.fn(),
    tickerFindMany: vi.fn(),
    tickerCount: vi.fn(),
    perfFindMany: vi.fn(),
    userFindMany: vi.fn(),
  };
});

// ── Resend mock ───────────────────────────────────────────────────────────────
// Use a class (not vi.fn()) because `new Resend(...)` requires a constructor;
// arrow-function-based spies are not constructable in some Vitest builds.

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: (...args: unknown[]) => mocks.batchSend(...args) };
  },
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mocks.scanFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mocks.tickerFindMany(...args),
      count: (...args: unknown[]) => mocks.tickerCount(...args),
    },
    tickerPerformance: {
      findMany: (...args: unknown[]) => mocks.perfFindMany(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    },
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const { sendWeeklyDigest } = await import("@/lib/email/weekly-digest");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTicker(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "NVDA",
    aiScore: 80,
    opportunityScore: 70,
    catalyst: "Unusual options activity",
    stage: "EARLY",
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_1",
    email: "test@example.com",
    subscription: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sendWeeklyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batchSend.mockResolvedValue({ data: { data: [{ id: "email_1" }] }, error: null });
    mocks.perfFindMany.mockResolvedValue([]);
    mocks.tickerCount.mockResolvedValue(10);
    mocks.userFindMany.mockResolvedValue([]);
  });

  // ── No completed scan → skip ──────────────────────────────────────────────

  it("returns zeroes when no completed scan exists", async () => {
    mocks.scanFindFirst.mockResolvedValue(null);
    const result = await sendWeeklyDigest();
    expect(result).toEqual({ sent: 0, skipped: 0, tickerCount: 0, performerCount: 0 });
    expect(mocks.tickerFindMany).not.toHaveBeenCalled();
  });

  it("queries the most recently completed scan", async () => {
    mocks.scanFindFirst.mockResolvedValue(null);
    await sendWeeklyDigest();
    const call = mocks.scanFindFirst.mock.calls[0][0];
    expect(call.where).toEqual({ status: "COMPLETED" });
    expect(call.orderBy).toEqual({ completedAt: "desc" });
  });

  // ── DB ordering: aiScore desc, opportunityScore desc (regression guard) ────

  it("orders tickers by aiScore desc then opportunityScore desc in the DB query", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([]);

    await sendWeeklyDigest();

    const call = mocks.tickerFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ aiScore: "desc" }, { opportunityScore: "desc" }]);
  });

  it("does NOT include stage in the DB orderBy (regression guard vs old stage-priority sort)", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([]);

    await sendWeeklyDigest();

    const call = mocks.tickerFindMany.mock.calls[0][0];
    expect(JSON.stringify(call.orderBy)).not.toContain("stage");
  });

  it("filters tickers to non-pnd, aiScore >= 50, EARLY/FORMING/CONFIRMED with buy/watch recommendation", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([]);

    await sendWeeklyDigest();

    const call = mocks.tickerFindMany.mock.calls[0][0];
    expect(call.where.pndFlagged).toBe(false);
    expect(call.where.aiScore).toEqual({ gte: 50 });
    expect(call.where.stage).toEqual({ in: ["EARLY", "FORMING", "CONFIRMED"] });
    expect(call.where.recommendation).toEqual({ in: ["Strong Buy", "Buy", "Watch"] });
  });

  // ── Core regression: CONFIRMED/90 must beat EARLY/50 ─────────────────────

  it("a CONFIRMED 90-score ticker appears before an EARLY 50-score ticker in the email", async () => {
    // Simulate what Prisma returns after `orderBy aiScore desc` (CONFIRMED/90 first)
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([
      makeTicker({ symbol: "HIGH", stage: "CONFIRMED", aiScore: 90, opportunityScore: 80 }),
      makeTicker({ symbol: "LOW", stage: "EARLY", aiScore: 50, opportunityScore: 60 }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    await sendWeeklyDigest();

    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    const highIdx = html.indexOf("$HIGH");
    const lowIdx = html.indexOf("$LOW");
    expect(highIdx).toBeGreaterThan(-1);
    expect(lowIdx).toBeGreaterThan(-1);
    expect(highIdx).toBeLessThan(lowIdx); // CONFIRMED/90 appears before EARLY/50
  });

  // ── Caps at 3 tickers ─────────────────────────────────────────────────────

  it("includes at most 3 tickers in the email regardless of how many the DB returns", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([
      makeTicker({ symbol: "A", aiScore: 95 }),
      makeTicker({ symbol: "B", aiScore: 90 }),
      makeTicker({ symbol: "C", aiScore: 85 }),
      makeTicker({ symbol: "D", aiScore: 80 }),
      makeTicker({ symbol: "E", aiScore: 75 }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    const result = await sendWeeklyDigest();

    expect(result.tickerCount).toBe(3);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    expect(html).toContain("$A");
    expect(html).toContain("$B");
    expect(html).toContain("$C");
    expect(html).not.toContain("$D");
    expect(html).not.toContain("$E");
  });

  // ── No qualifying tickers → skip ─────────────────────────────────────────

  it("skips sending when no tickers pass the filter", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([]);
    mocks.tickerCount.mockResolvedValue(0);

    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0, skipped: 0, tickerCount: 0, performerCount: 0 });
    expect(mocks.batchSend).not.toHaveBeenCalled();
  });

  // ── No users with emailAlerts → no emails ────────────────────────────────

  it("skips sending when no users have emailAlerts enabled", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([makeTicker()]);
    mocks.userFindMany.mockResolvedValue([]);

    const result = await sendWeeklyDigest();

    expect(result.sent).toBe(0);
    expect(mocks.batchSend).not.toHaveBeenCalled();
  });

  // ── Subscriber vs free user CTA ───────────────────────────────────────────

  it("sends subscriber HTML (dashboard link, no upgrade CTA) to ACTIVE subscribers", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([makeTicker()]);
    mocks.userFindMany.mockResolvedValue([
      makeUser({ email: "sub@example.com", subscription: { status: "ACTIVE" } }),
    ]);

    await sendWeeklyDigest();

    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    expect(batch[0].html).toContain("localhost:3000/dashboard");
    expect(batch[0].html).not.toContain("Upgrade to Pro");
  });

  it("sends free HTML (upgrade CTA, no dashboard link) to users without active subscription", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([makeTicker()]);
    mocks.userFindMany.mockResolvedValue([
      makeUser({ email: "free@example.com", subscription: null }),
    ]);

    await sendWeeklyDigest();

    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    expect(batch[0].html).toContain("Upgrade to Pro");
    expect(batch[0].html).not.toContain("View all");
  });

  it("sends free HTML to users with CANCELED subscription", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([makeTicker()]);
    mocks.userFindMany.mockResolvedValue([
      makeUser({ email: "canceled@example.com", subscription: { status: "CANCELED" } }),
    ]);

    await sendWeeklyDigest();

    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    expect(batch[0].html).toContain("Upgrade to Pro");
  });

  // ── Resend batch error → counts as skipped ────────────────────────────────

  it("counts batch-send failures as skipped", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([makeTicker()]);
    mocks.userFindMany.mockResolvedValue([
      makeUser(),
      makeUser({ id: "user_2", email: "b@example.com" }),
    ]);
    mocks.batchSend.mockResolvedValue({ data: null, error: { message: "rate limited" } });

    const result = await sendWeeklyDigest();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it("returns correct sent/skipped/tickerCount/performerCount on success", async () => {
    mocks.scanFindFirst.mockResolvedValue({ id: "scan_1" });
    mocks.tickerFindMany.mockResolvedValue([
      makeTicker({ symbol: "A" }),
      makeTicker({ symbol: "B" }),
    ]);
    mocks.userFindMany.mockResolvedValue([
      makeUser(),
      makeUser({ id: "user_2", email: "b@example.com" }),
    ]);
    mocks.batchSend.mockResolvedValue({ data: { data: [{ id: "e1" }, { id: "e2" }] }, error: null });

    const result = await sendWeeklyDigest();

    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.tickerCount).toBe(2);
    expect(result.performerCount).toBe(0);
  });
});
