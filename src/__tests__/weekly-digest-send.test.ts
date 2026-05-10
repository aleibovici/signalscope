import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted runs before vi.mock factories and module imports.
// We use it to (a) set RESEND_API_KEY so the module-level `new Resend(...)` is
// not skipped, and (b) create mock functions that are accessible inside vi.mock
// factories (plain `const mockFn = vi.fn()` is NOT accessible there).
const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  return {
    batchSend: vi.fn(),
    perfFindMany: vi.fn(),
    perfCount: vi.fn(),
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
    tickerPerformance: {
      findMany: (...args: unknown[]) => mocks.perfFindMany(...args),
      count: (...args: unknown[]) => mocks.perfCount(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    },
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const { sendWeeklyDigest } = await import("@/lib/email/weekly-digest");

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PerfRowOverrides {
  symbol?: string;
  return1d?: number | null;
  return3d?: number | null;
  return7d?: number | null;
  aiScore?: number;
  opportunityScore?: number;
  catalyst?: string | null;
  stage?: string;
  pndFlagged?: boolean;
  recommendation?: string;
}

function makePerfRow(overrides: PerfRowOverrides = {}) {
  const {
    symbol = "NVDA",
    return1d = null,
    return3d = null,
    return7d = 0.1,
    aiScore = 80,
    opportunityScore = 70,
    catalyst = "Unusual options activity",
    stage = "EARLY",
  } = overrides;
  return {
    return1d,
    return3d,
    return7d,
    validatedTicker: {
      symbol,
      aiScore,
      opportunityScore,
      catalyst,
      stage,
    },
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
    mocks.perfCount.mockResolvedValue(10);
    mocks.userFindMany.mockResolvedValue([]);
  });

  // ── Selection window: 7 days ──────────────────────────────────────────────

  it("queries TickerPerformance with a 7-day createdAt cutoff", async () => {
    const before = Date.now();
    await sendWeeklyDigest();
    const after = Date.now();

    const call = mocks.perfFindMany.mock.calls[0][0];
    const cutoff: Date = call.where.createdAt.gte;
    const cutoffMs = cutoff.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(cutoffMs).toBeGreaterThanOrEqual(before - sevenDaysMs - 1000);
    expect(cutoffMs).toBeLessThanOrEqual(after - sevenDaysMs + 1000);
  });

  it("filters to non-pnd, Buy/Strong Buy/Watch, no corporate actions", async () => {
    await sendWeeklyDigest();

    const call = mocks.perfFindMany.mock.calls[0][0];
    expect(call.where.corporateActionDetected).toBe(false);
    expect(call.where.validatedTicker.pndFlagged).toBe(false);
    expect(call.where.validatedTicker.recommendation).toEqual({
      in: ["Strong Buy", "Buy", "Watch"],
    });
  });

  // ── Best-of-1d/3d/7d return per row ───────────────────────────────────────

  it("ranks each pick by the BEST of return1d/3d/7d", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "PEAK1D", return1d: 0.30, return3d: 0.10, return7d: 0.05 }),
      makePerfRow({ symbol: "PEAK3D", return1d: 0.05, return3d: 0.25, return7d: 0.10 }),
      makePerfRow({ symbol: "PEAK7D", return1d: 0.05, return3d: 0.10, return7d: 0.20 }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    await sendWeeklyDigest();

    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    // Order: PEAK1D 30% > PEAK3D 25% > PEAK7D 20%
    const i1 = html.indexOf("$PEAK1D");
    const i3 = html.indexOf("$PEAK3D");
    const i7 = html.indexOf("$PEAK7D");
    expect(i1).toBeGreaterThan(-1);
    expect(i3).toBeGreaterThan(-1);
    expect(i7).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i3);
    expect(i3).toBeLessThan(i7);
    // Each row should be labeled with its best period
    expect(html).toMatch(/\$PEAK1D[\s\S]*?\(1d\)/);
    expect(html).toMatch(/\$PEAK3D[\s\S]*?\(3d\)/);
    expect(html).toMatch(/\$PEAK7D[\s\S]*?\(7d\)/);
  });

  it("skips picks whose best return is zero or negative", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "WIN", return1d: 0.10, return3d: -0.05, return7d: -0.02 }),
      makePerfRow({ symbol: "FLAT", return1d: 0, return3d: -0.01, return7d: -0.05 }),
      makePerfRow({ symbol: "LOSS", return1d: -0.10, return3d: -0.05, return7d: -0.02 }),
      makePerfRow({ symbol: "NULL", return1d: null, return3d: null, return7d: null }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    await sendWeeklyDigest();

    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    expect(html).toContain("$WIN");
    expect(html).not.toContain("$FLAT");
    expect(html).not.toContain("$LOSS");
    expect(html).not.toContain("$NULL");
  });

  // ── Dedupe by symbol ──────────────────────────────────────────────────────

  it("dedupes by symbol and keeps the highest-return row", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "AAPL", return1d: 0.05, return3d: null, return7d: null }),
      makePerfRow({ symbol: "AAPL", return1d: 0.20, return3d: null, return7d: null }),
      makePerfRow({ symbol: "AAPL", return1d: 0.10, return3d: null, return7d: null }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    const result = await sendWeeklyDigest();

    expect(result.tickerCount).toBe(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    expect(html).toContain("+20.0%");
    expect(html).not.toContain("+10.0%");
    expect(html).not.toContain("+5.0%");
  });

  // ── Top 5 cap ─────────────────────────────────────────────────────────────

  it("includes at most 5 tickers in the email", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "A", return1d: 0.50 }),
      makePerfRow({ symbol: "B", return1d: 0.40 }),
      makePerfRow({ symbol: "C", return1d: 0.30 }),
      makePerfRow({ symbol: "D", return1d: 0.20 }),
      makePerfRow({ symbol: "E", return1d: 0.10 }),
      makePerfRow({ symbol: "F", return1d: 0.05 }),
      makePerfRow({ symbol: "G", return1d: 0.04 }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    const result = await sendWeeklyDigest();

    expect(result.tickerCount).toBe(5);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    const html = batch[0].html;
    expect(html).toContain("$A");
    expect(html).toContain("$E");
    expect(html).not.toContain("$F");
    expect(html).not.toContain("$G");
  });

  // ── No qualifying performers → skip ───────────────────────────────────────

  it("skips sending when no picks have positive returns in the window", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "FLAT", return1d: 0, return3d: 0, return7d: 0 }),
    ]);

    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0, skipped: 0, tickerCount: 0 });
    expect(mocks.batchSend).not.toHaveBeenCalled();
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("returns zeroes when the 7-day window is empty", async () => {
    mocks.perfFindMany.mockResolvedValue([]);

    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0, skipped: 0, tickerCount: 0 });
    expect(mocks.batchSend).not.toHaveBeenCalled();
  });

  // ── No users with emailAlerts → no emails ────────────────────────────────

  it("skips sending when no users have emailAlerts enabled", async () => {
    mocks.perfFindMany.mockResolvedValue([makePerfRow({ return1d: 0.10 })]);
    mocks.userFindMany.mockResolvedValue([]);

    const result = await sendWeeklyDigest();

    expect(result.sent).toBe(0);
    expect(mocks.batchSend).not.toHaveBeenCalled();
  });

  // ── Subscriber vs free user CTA ───────────────────────────────────────────

  it("sends subscriber HTML (dashboard link, no upgrade CTA) to ACTIVE subscribers", async () => {
    mocks.perfFindMany.mockResolvedValue([makePerfRow({ return1d: 0.10 })]);
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
    mocks.perfFindMany.mockResolvedValue([makePerfRow({ return1d: 0.10 })]);
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
    mocks.perfFindMany.mockResolvedValue([makePerfRow({ return1d: 0.10 })]);
    mocks.userFindMany.mockResolvedValue([
      makeUser({ email: "canceled@example.com", subscription: { status: "CANCELED" } }),
    ]);

    await sendWeeklyDigest();

    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ html: string }>;
    expect(batch[0].html).toContain("Upgrade to Pro");
  });

  // ── Subject line ──────────────────────────────────────────────────────────

  it("subject line headlines the top 3 winners with their returns", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "AAA", return1d: 0.30 }),
      makePerfRow({ symbol: "BBB", return1d: 0.20 }),
      makePerfRow({ symbol: "CCC", return1d: 0.10 }),
      makePerfRow({ symbol: "DDD", return1d: 0.05 }),
    ]);
    mocks.userFindMany.mockResolvedValue([makeUser()]);

    await sendWeeklyDigest();

    const batch = mocks.batchSend.mock.calls[0][0] as Array<{ subject: string }>;
    expect(batch[0].subject).toContain("$AAA");
    expect(batch[0].subject).toContain("+30.0%");
    expect(batch[0].subject).toContain("$BBB");
    expect(batch[0].subject).toContain("$CCC");
    expect(batch[0].subject).not.toContain("$DDD");
  });

  // ── Resend batch error → counts as skipped ────────────────────────────────

  it("counts batch-send failures as skipped", async () => {
    mocks.perfFindMany.mockResolvedValue([makePerfRow({ return1d: 0.10 })]);
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

  it("returns correct sent/skipped/tickerCount on success", async () => {
    mocks.perfFindMany.mockResolvedValue([
      makePerfRow({ symbol: "A", return1d: 0.20 }),
      makePerfRow({ symbol: "B", return1d: 0.15 }),
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
  });
});
