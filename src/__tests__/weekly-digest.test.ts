import { describe, it, expect } from "vitest";
import { buildWeeklyDigestHtml } from "@/lib/email/weekly-digest";

const makeTicker = (overrides = {}) => ({
  symbol: "NVDA",
  aiScore: 85,
  opportunityScore: 90,
  catalyst: "Unusual options activity detected across multiple strikes",
  stage: "EARLY",
  returnPct: null,
  returnPeriod: null,
  ...overrides,
});

const makePerformer = (overrides = {}) => ({
  symbol: "AAPL",
  returnPct: 0.15,
  period: "7d",
  ...overrides,
});

describe("buildWeeklyDigestHtml", () => {
  it("returns valid HTML", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 10, false);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("includes weekly digest header", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 10, false);
    expect(html).toContain("Weekly Digest");
  });

  it("includes ticker symbols with links", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ symbol: "TSLA" }), makeTicker({ symbol: "AAPL" })],
      [],
      10,
      false
    );
    expect(html).toContain("$TSLA");
    expect(html).toContain("$AAPL");
    expect(html).toContain("localhost:3000/ticker/TSLA");
    expect(html).toContain("localhost:3000/ticker/AAPL");
  });

  it("includes AI score and opportunity score", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ aiScore: 82, opportunityScore: 91 })],
      [],
      10,
      false
    );
    expect(html).toContain("82/100");
    expect(html).toContain("91/100");
  });

  it("includes catalyst text", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ catalyst: "CEO bought $5M in shares" })],
      [],
      10,
      false
    );
    expect(html).toContain("CEO bought $5M in shares");
  });

  it("shows stage labels", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker({ stage: "EARLY" }), makeTicker({ symbol: "TSLA", stage: "FORMING" })],
      [],
      10,
      false
    );
    expect(html).toContain("Emerging");
    expect(html).toContain("Building");
  });

  it("shows upgrade CTA for free users", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 25, false);
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain("localhost:3000/subscription");
    expect(html).toContain("25 signals were detected");
  });

  it("shows dashboard link for subscribers", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 25, true);
    expect(html).toContain("View all 25 signals");
    expect(html).toContain("localhost:3000/dashboard");
    expect(html).not.toContain("Upgrade to Pro");
  });

  it("includes performers section when provided", () => {
    const performers = [
      makePerformer({ symbol: "NVDA", returnPct: 0.231, period: "7d" }),
      makePerformer({ symbol: "TSLA", returnPct: 0.12, period: "3d" }),
    ];
    const html = buildWeeklyDigestHtml([makeTicker()], performers, 10, false);
    expect(html).toContain("Recent Winners");
    expect(html).toContain("$NVDA");
    expect(html).toContain("+23.1%");
    expect(html).toContain("$TSLA");
    expect(html).toContain("+12.0%");
  });

  it("omits performers section when empty", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 10, false);
    expect(html).not.toContain("Recent Winners");
  });

  it("includes unsubscribe link", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 10, false);
    expect(html).toContain("localhost:3000/profile");
    expect(html).toContain("profile settings");
  });

  it("mentions source diversity", () => {
    const html = buildWeeklyDigestHtml([makeTicker()], [], 10, false);
    expect(html).toContain("Reddit");
    expect(html).toContain("SEC filings");
    expect(html).toContain("congressional trades");
  });

  it("handles negative performer returns with red color", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker()],
      [makePerformer({ returnPct: -0.05 })],
      10,
      false
    );
    expect(html).toContain("-5.0%");
    expect(html).toContain("#dc2626"); // red color
  });

  it("uses green color for positive performer returns", () => {
    const html = buildWeeklyDigestHtml(
      [makeTicker()],
      [makePerformer({ returnPct: 0.15 })],
      10,
      false
    );
    expect(html).toContain("+15.0%");
    expect(html).toContain("#16a34a"); // green color
  });
});
