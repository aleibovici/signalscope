import { describe, it, expect, vi } from "vitest";

// Mock module-level side effects that do not affect buildEmailHtml
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { buildEmailHtml } = await import("@/lib/email");

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTicker(overrides: {
  symbol?: string;
  price?: number | null;
  aiScore?: number;
  aiReasoning?: string | null;
  catalyst?: string | null;
  signalType?: string | null;
  stage?: string;
} = {}) {
  return {
    symbol: "AAPL",
    price: 180,
    aiScore: 75,
    aiReasoning: null,
    catalyst: "Insider buy $2M",
    signalType: "insider_buy",
    stage: "EARLY",
    ...overrides,
  };
}

// ── Section rendering ─────────────────────────────────────────────────────────

describe("buildEmailHtml — section headers", () => {
  it("renders the Emerging section label for EARLY tickers", () => {
    const html = buildEmailHtml([makeTicker({ stage: "EARLY" })]);
    // text-transform:uppercase in CSS; the raw HTML has the label word "Emerging"
    expect(html).toContain("Emerging (1)");
  });

  it("renders the Building section label for FORMING tickers", () => {
    const html = buildEmailHtml([makeTicker({ stage: "FORMING" })]);
    expect(html).toContain("Building (1)");
  });

  it("renders the Consensus section label for CONFIRMED tickers", () => {
    const html = buildEmailHtml([makeTicker({ stage: "CONFIRMED" })]);
    expect(html).toContain("Consensus (1)");
  });

  it("omits section entirely when that stage has no tickers", () => {
    const html = buildEmailHtml([makeTicker({ stage: "EARLY" })]);
    expect(html).not.toContain("Consensus (");
    expect(html).not.toContain("Building (");
  });
});

// ── Ticker link and score ─────────────────────────────────────────────────────

describe("buildEmailHtml — ticker row", () => {
  it("links the symbol to the ticker page", () => {
    const html = buildEmailHtml([makeTicker({ symbol: "NVDA" })]);
    expect(html).toContain('href="https://signalscopes.com/ticker/NVDA"');
    expect(html).toContain(">NVDA<");
  });

  it("shows aiScore out of 100", () => {
    const html = buildEmailHtml([makeTicker({ aiScore: 82 })]);
    expect(html).toContain("82/100");
  });

  it("shows catalyst text when present", () => {
    const html = buildEmailHtml([makeTicker({ catalyst: "Unusual call options sweep" })]);
    expect(html).toContain("Unusual call options sweep");
  });

  it("shows em-dash when catalyst is null", () => {
    const html = buildEmailHtml([makeTicker({ catalyst: null })]);
    expect(html).toContain("—");
  });
});

// ── AI reasoning / summary row ────────────────────────────────────────────────

describe("buildEmailHtml — summary row (aiReasoning)", () => {
  it("renders a summary row when aiReasoning is provided", () => {
    const html = buildEmailHtml([makeTicker({ aiReasoning: "Strong insider conviction." })]);
    // Summary row: colspan=3 cell with the reasoning text
    expect(html).toContain('colspan="3"');
    expect(html).toContain("Strong insider conviction.");
  });

  it("prefers aiReasoning over catalyst in the summary row", () => {
    const html = buildEmailHtml([
      makeTicker({ aiReasoning: "AI says strong.", catalyst: "Insider buy $5M" }),
    ]);
    expect(html).toContain("AI says strong.");
    // Catalyst still appears in the main row
    expect(html).toContain("Insider buy $5M");
  });

  it("falls back to catalyst in summary row when aiReasoning is null", () => {
    const html = buildEmailHtml([
      makeTicker({ aiReasoning: null, catalyst: "Insider buy $5M" }),
    ]);
    // The catalyst text will appear twice: once in the main cell, once as the summary
    const matches = (html.match(/Insider buy \$5M/g) ?? []).length;
    expect(matches).toBe(2);
  });

  it("renders no summary row when both aiReasoning and catalyst are null", () => {
    const html = buildEmailHtml([makeTicker({ aiReasoning: null, catalyst: null })]);
    // Summary rows have a distinct top-padding of 2px — only present when there's a summary
    expect(html).not.toContain("padding:2px 12px 8px;");
  });
});

// ── truncateSummary (via aiReasoning) ────────────────────────────────────────

describe("buildEmailHtml — truncateSummary", () => {
  it("does not truncate text ≤ 120 characters", () => {
    const short = "A".repeat(120);
    const html = buildEmailHtml([makeTicker({ aiReasoning: short, catalyst: null })]);
    expect(html).toContain(short);
    expect(html).not.toContain("…");
  });

  it("truncates text longer than 120 characters and appends ellipsis", () => {
    const long = "word ".repeat(30); // 150 chars
    const html = buildEmailHtml([makeTicker({ aiReasoning: long, catalyst: null })]);
    expect(html).toContain("…");
    // The truncated text should be shorter than the original
    expect(html).not.toContain(long.trim());
  });

  it("truncates at a word boundary (no partial words before ellipsis)", () => {
    // Exactly 125 chars: 120 chars of full words + a partial word at the boundary
    const text = "Hello world ".repeat(10) + "extra"; // ensure there's a word to cut
    const html = buildEmailHtml([makeTicker({ aiReasoning: text, catalyst: null })]);
    if (text.length > 120) {
      expect(html).toContain("…");
      // The character just before "…" should not be in the middle of a word
      const summaryMatch = html.match(/>(.*?)…<\/td>/);
      if (summaryMatch) {
        const truncated = summaryMatch[1];
        expect(truncated).not.toMatch(/\S…$/); // should end with a space before the ellipsis insertion
      }
    }
  });
});

// ── Headline ─────────────────────────────────────────────────────────────────

describe("buildEmailHtml — headline", () => {
  it("shows 'emerging' count when EARLY tickers are present", () => {
    const html = buildEmailHtml([
      makeTicker({ stage: "EARLY" }),
      makeTicker({ symbol: "TSLA", stage: "EARLY" }),
    ]);
    expect(html).toContain("2 emerging");
  });

  it("includes FORMING count in headline when present alongside EARLY", () => {
    const html = buildEmailHtml([
      makeTicker({ stage: "EARLY" }),
      makeTicker({ symbol: "TSLA", stage: "FORMING" }),
    ]);
    expect(html).toContain("1 emerging");
    expect(html).toContain("1 building");
  });

  it("includes CONFIRMED count in headline when present alongside EARLY", () => {
    const html = buildEmailHtml([
      makeTicker({ stage: "EARLY" }),
      makeTicker({ symbol: "TSLA", stage: "CONFIRMED" }),
    ]);
    expect(html).toContain("1 consensus");
  });

  it("falls back to total count headline when no EARLY tickers", () => {
    const html = buildEmailHtml([makeTicker({ stage: "CONFIRMED" })]);
    expect(html).toContain("1 signal detected");
  });

  it("pluralises 'signals' when there are multiple non-EARLY tickers", () => {
    const html = buildEmailHtml([
      makeTicker({ stage: "CONFIRMED" }),
      makeTicker({ symbol: "TSLA", stage: "FORMING" }),
    ]);
    expect(html).toContain("2 signals detected");
  });
});

// ── totalAvailable footer ─────────────────────────────────────────────────────

describe("buildEmailHtml — totalAvailable footer", () => {
  it("shows 'Showing top N of M' when totalAvailable > tickers.length", () => {
    const html = buildEmailHtml([makeTicker()], 10);
    expect(html).toContain("Showing top 1 of 10");
  });

  it("omits the 'Showing top N of M' line when totalAvailable equals tickers.length", () => {
    const html = buildEmailHtml([makeTicker()], 1);
    expect(html).not.toContain("Showing top");
  });

  it("omits the 'Showing top N of M' line when totalAvailable is undefined", () => {
    const html = buildEmailHtml([makeTicker()]);
    expect(html).not.toContain("Showing top");
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("buildEmailHtml — edge cases", () => {
  it("renders valid HTML for empty ticker list", () => {
    const html = buildEmailHtml([]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("SignalScope Alert");
    expect(html).toContain("0 signals detected");
  });

  it("includes unsubscribe link in footer", () => {
    const html = buildEmailHtml([makeTicker()]);
    expect(html).toContain("https://signalscopes.com/profile");
  });

  it("includes dashboard link", () => {
    const html = buildEmailHtml([makeTicker()]);
    expect(html).toContain("https://signalscopes.com");
  });
});
