import { describe, it, expect } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";
import { extractTxIdsFromUrls, deduplicateCongressSignals } from "@/lib/harvester/index";

function congressSignal(symbol: string, txId: number): RawSignal {
  return {
    symbol,
    source: "CONGRESS",
    title: `Congress buy: Sen. Test purchased ${symbol}`,
    url: `https://www.capitoltrades.com/trades?ticker=${symbol}&txId=${txId}`,
    purchaseValue: 8000,
  };
}

function redditSignal(symbol: string): RawSignal {
  return { symbol, source: "REDDIT", title: `${symbol} to the moon` };
}

describe("extractTxIdsFromUrls", () => {
  it("extracts txId from congress signal URLs", () => {
    const urls = [
      "https://www.capitoltrades.com/trades?ticker=UBER&txId=10000064712",
      "https://www.capitoltrades.com/trades?ticker=MSFT&txId=10000064714",
    ];
    const ids = extractTxIdsFromUrls(urls);
    expect(ids).toEqual(new Set(["10000064712", "10000064714"]));
  });

  it("returns empty set for empty input", () => {
    expect(extractTxIdsFromUrls([])).toEqual(new Set());
  });

  it("skips URLs without txId param", () => {
    const urls = [
      "https://www.capitoltrades.com/trades?ticker=UBER",
      "https://www.capitoltrades.com/trades?ticker=MSFT&txId=123",
    ];
    const ids = extractTxIdsFromUrls(urls);
    expect(ids).toEqual(new Set(["123"]));
  });
});

describe("deduplicateCongressSignals", () => {
  it("removes congress signals with already-seen txIds", () => {
    const signals = [
      congressSignal("UBER", 100),
      congressSignal("MSFT", 200),
      congressSignal("AAPL", 300),
    ];
    const seenTxIds = new Set(["100", "300"]);

    const result = deduplicateCongressSignals(signals, seenTxIds);

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("MSFT");
  });

  it("passes through non-CONGRESS signals even if seenTxIds is populated", () => {
    const signals = [
      redditSignal("AAPL"),
      congressSignal("UBER", 100),
      redditSignal("TSLA"),
    ];
    const seenTxIds = new Set(["100"]);

    const result = deduplicateCongressSignals(signals, seenTxIds);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.source)).toEqual(["REDDIT", "REDDIT"]);
  });

  it("returns all signals when seenTxIds is empty", () => {
    const signals = [
      congressSignal("UBER", 100),
      congressSignal("MSFT", 200),
      redditSignal("AAPL"),
    ];

    const result = deduplicateCongressSignals(signals, new Set());
    expect(result).toHaveLength(3);
  });

  it("keeps congress signals without a URL", () => {
    const noUrl: RawSignal = { symbol: "UBER", source: "CONGRESS", title: "test" };
    const signals = [noUrl, congressSignal("MSFT", 200)];
    const seenTxIds = new Set(["200"]);

    const result = deduplicateCongressSignals(signals, seenTxIds);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(noUrl);
  });

  it("removes all congress signals when all txIds are seen", () => {
    const signals = [
      congressSignal("UBER", 100),
      congressSignal("MSFT", 200),
    ];
    const seenTxIds = new Set(["100", "200"]);

    const result = deduplicateCongressSignals(signals, seenTxIds);
    expect(result).toHaveLength(0);
  });

  it("handles mixed signal types correctly", () => {
    const signals: RawSignal[] = [
      redditSignal("AAPL"),
      congressSignal("UBER", 100),  // seen — should be removed
      { symbol: "TSLA", source: "VOLUME_SPIKE", title: "vol spike" },
      congressSignal("MSFT", 200),  // new — should stay
      congressSignal("NVDA", 300),  // seen — should be removed
      { symbol: "GME", source: "TWITTER", title: "tweet" },
    ];
    const seenTxIds = new Set(["100", "300"]);

    const result = deduplicateCongressSignals(signals, seenTxIds);

    expect(result).toHaveLength(4);
    expect(result.map((s) => `${s.source}:${s.symbol}`)).toEqual([
      "REDDIT:AAPL",
      "VOLUME_SPIKE:TSLA",
      "CONGRESS:MSFT",
      "TWITTER:GME",
    ]);
  });
});
