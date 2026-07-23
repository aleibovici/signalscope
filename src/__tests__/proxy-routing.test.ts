import { describe, it, expect, vi } from "vitest";

// Mock next-auth so the module-level NextAuth() call in proxy.ts doesn't
// attempt real initialization (no AUTH_SECRET needed in unit tests).
vi.mock("next-auth", () => ({
  default: () => ({ auth: vi.fn() }),
}));
vi.mock("@/lib/auth.config", () => ({
  authConfig: {},
}));

const { isPublicPath, isX402Path } = await import("@/proxy");

describe("isPublicPath", () => {
  // ── Exact public pages ──────────────────────────────────────────────────
  it.each([
    "/",          // landing page — added in f055bcf to allow unauthenticated access
    "/login",
    "/register",
    "/changelog",
    "/privacy",
    "/faq",
    "/how-it-works",
    "/dashboard",
    "/trending",
    "/connections",
    "/performance",
    "/methodology",
    "/opengraph-image",
    "/api/search",
    "/api/methodology",
    "/api/stats/performance",
  ])("treats %s as public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  // ── Public page prefixes (/blog/*, /ticker/*) ───────────────────────────
  it("treats /blog/some-post as public (prefix match)", () => {
    expect(isPublicPath("/blog/some-post")).toBe(true);
  });

  it("treats /ticker/AAPL as public (prefix match)", () => {
    expect(isPublicPath("/ticker/AAPL")).toBe(true);
  });

  it("treats /ticker itself as public", () => {
    expect(isPublicPath("/ticker")).toBe(true);
  });

  it("treats /blog itself as public", () => {
    expect(isPublicPath("/blog")).toBe(true);
  });

  // ── Public API prefixes ─────────────────────────────────────────────────
  it.each([
    "/api/auth",
    "/api/auth/login",
    "/api/auth/callback/credentials",
    "/api/health",
    "/api/alerts",
    "/api/alerts/send",
    "/api/harvest",
    "/api/harvest/ingest",
    "/api/snapshots",
    "/api/snapshots/collect",
    "/api/reports",
    "/api/reports/generate",
    "/api/tweets",
    "/api/tweets/post",
    "/api/twitter",
    "/api/twitter/follow",
    "/api/linkedin",
    "/api/linkedin/promo",
    "/api/stripe/webhook",
    "/api/scans",
    "/api/scans/scan_123",
    "/api/signals",
    // Note: isPublicPath receives req.nextUrl.pathname (no query string)
    "/api/stats",
    "/api/stats/something",
    "/api/prices",
    "/api/performance",
  ])("treats %s as public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  // ── Boundary check: /api/scans-admin must NOT match /api/scans prefix ──
  it("does NOT treat /api/scans-admin as public (boundary check)", () => {
    expect(isPublicPath("/api/scans-admin")).toBe(false);
  });

  it("does NOT treat /api/statsmore as public (boundary check)", () => {
    expect(isPublicPath("/api/statsmore")).toBe(false);
  });

  // ── /results section (merged Performance + Paper Trading) ─────────────
  it("treats /results as public (redirect page)", () => {
    expect(isPublicPath("/results")).toBe(true);
  });

  it("treats /results/signal-quality as public (replaces /performance)", () => {
    expect(isPublicPath("/results/signal-quality")).toBe(true);
  });

  it("does NOT treat /results/simulated-portfolio as public (replaces /paper-trading, requires auth)", () => {
    expect(isPublicPath("/results/simulated-portfolio")).toBe(false);
  });

  it("does NOT treat /results/signal-quality/subpath as public (only exact match, no prefix expansion)", () => {
    expect(isPublicPath("/results/signal-quality/extra")).toBe(false);
  });

  it("does NOT treat /results/other as public (unrecognised sub-path)", () => {
    expect(isPublicPath("/results/other")).toBe(false);
  });

  // ── Protected routes — must NOT be public ──────────────────────────────
  it.each([
    "/api/portfolio",
    "/api/portfolio/pos_1",
    "/api/watchlist",
    "/api/watchlist/tickers",
    "/api/user/profile",
    "/api/user/api-key",
    "/api/stripe/checkout",
    "/api/stripe/portal",
    "/admin",
    "/admin/users",
    "/api/admin",
    "/api/admin/something",
  ])("does NOT treat %s as public (protected route)", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("isX402Path", () => {
  it("treats /api/tickers exactly as x402", () => {
    expect(isX402Path("/api/tickers")).toBe(true);
  });

  it("treats /api/tickers/AAPL as x402", () => {
    expect(isX402Path("/api/tickers/AAPL")).toBe(true);
  });

  it("treats /api/tickers/AAPL/report as x402", () => {
    expect(isX402Path("/api/tickers/AAPL/report")).toBe(true);
  });

  it("treats /api/tickers/trending as x402", () => {
    expect(isX402Path("/api/tickers/trending")).toBe(true);
  });

  it("does NOT treat /api/tickers-admin as x402 (boundary check)", () => {
    expect(isX402Path("/api/tickers-admin")).toBe(false);
  });

  it("does NOT treat /api/scans as x402", () => {
    expect(isX402Path("/api/scans")).toBe(false);
  });

  it("does NOT treat / as x402", () => {
    expect(isX402Path("/")).toBe(false);
  });
});
