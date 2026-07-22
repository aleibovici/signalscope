import { describe, it, expect } from "vitest";
import { buildWeeklyDigestHtml } from "@/lib/email/weekly-digest";

const makeTicker = (overrides = {}) => ({
  symbol: "NVDA",
  aiScore: 85,
  opportunityScore: 90,
  catalyst: "Unusual options activity detected across multiple strikes",
  stage: "EARLY",
  returnPct: 0.12,
  returnPeriod: "7d",
  ...overrides,
});

describe("buildWeeklyDigestHtml", () => {
  it("returns valid HTML", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 10, false);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("includes weekly digest header", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 10, false);
    expect(html).toContain("Weekly Digest");
  });

  it("advertises this week's top performers in the subtitle", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 10, false);
    expect(html).toContain("top performers");
  });

  it("includes ticker symbols with links", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ symbol: "TSLA" }), makeTicker({ symbol: "AAPL" })],
      10,
      false
    );
    expect(html).toContain("$TSLA");
    expect(html).toContain("$AAPL");
    expect(html).toContain("localhost:3000/ticker/TSLA");
    expect(html).toContain("localhost:3000/ticker/AAPL");
  });

  it("includes the AI score", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ aiScore: 82 })],
      10,
      false
    );
    expect(html).toContain("82/100");
  });

  it("renders each pick's return with its period", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ symbol: "NVDA", returnPct: 0.231, returnPeriod: "7d" })],
      10,
      false
    );
    expect(html).toContain("+23.1%");
    expect(html).toContain("(7d)");
  });

  it("includes catalyst text", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ catalyst: "CEO bought $5M in shares" })],
      10,
      false
    );
    expect(html).toContain("CEO bought $5M in shares");
  });

  it("shows stage labels", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ stage: "EARLY" }), makeTicker({ symbol: "TSLA", stage: "FORMING" })],
      10,
      false
    );
    expect(html).toContain("Emerging");
    expect(html).toContain("Building");
  });

  it("shows upgrade CTA for free users", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 25, false);
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain("localhost:3000/subscription");
    expect(html).toContain("25 signals were detected");
  });

  it("shows dashboard link for subscribers", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 25, true);
    expect(html).toContain("View all 25 signals");
    expect(html).toContain("localhost:3000/dashboard");
    expect(html).not.toContain("Upgrade to Pro");
  });

  it("no longer includes a separate 'Recent Winners' proof section", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ symbol: "NVDA", returnPct: 0.15 })],
      10,
      false
    );
    expect(html).not.toContain("Recent Winners");
  });

  it("includes unsubscribe link", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 10, false);
    expect(html).toContain("localhost:3000/profile");
    expect(html).toContain("profile settings");
  });

  it("mentions source diversity", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], 10, false);
    expect(html).toContain("Reddit");
    expect(html).toContain("SEC filings");
    expect(html).toContain("congressional trades");
  });

  it("uses green color for positive returns", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ returnPct: 0.15 })],
      10,
      false
    );
    expect(html).toContain("+15.0%");
    expect(html).toContain("#16a34a"); // green
  });

  it("uses red color for negative returns (defensive — selection should normally exclude these)", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ returnPct: -0.05 })],
      10,
      false
    );
    expect(html).toContain("-5.0%");
    expect(html).toContain("#dc2626"); // red
  });
});
