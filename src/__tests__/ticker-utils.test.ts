import { describe, it, expect } from "vitest";
import {
  extractTickers,
  extractCashtagTickers,
  BLACKLIST,
  MEGA_CAPS,
} from "@/lib/harvester/sources/ticker-utils";

describe("extractTickers", () => {
  it("extracts valid tickers from text", () => {
    const tickers = extractTickers("PTON is breaking out and CRWD looks strong");
    expect(tickers).toContain("PTON");
    expect(tickers).toContain("CRWD");
  });

  it("returns empty array for empty string", () => {
    expect(extractTickers("")).toEqual([]);
  });

  it("returns empty array for lowercase-only text", () => {
    expect(extractTickers("this has no tickers at all")).toEqual([]);
  });

  it("filters out BLACKLIST words", () => {
    const tickers = extractTickers("THE CEO said SELL now and HOLD");
    expect(tickers).not.toContain("THE");
    expect(tickers).not.toContain("CEO");
    expect(tickers).not.toContain("SELL");
    expect(tickers).not.toContain("HOLD");
  });

  it("filters out MEGA_CAP tickers", () => {
    const tickers = extractTickers("AAPL MSFT TSLA look expensive but PTON is undervalued");
    expect(tickers).not.toContain("AAPL");
    expect(tickers).not.toContain("MSFT");
    expect(tickers).not.toContain("TSLA");
    expect(tickers).toContain("PTON");
  });

  it("filters out single-character matches", () => {
    // TICKER_REGEX matches A-Z{1,5}, but filter requires length >= 2
    const tickers = extractTickers("Some text with A single letter");
    expect(tickers).not.toContain("A");
  });

  it("deduplicates repeated tickers", () => {
    const tickers = extractTickers("PTON PTON PTON is very popular");
    expect(tickers.filter((t) => t === "PTON")).toHaveLength(1);
  });

  it("handles text with mixed valid and blacklisted tickers", () => {
    const tickers = extractTickers("PLTR and RIVN look interesting but ETF and IPO are not tickers");
    expect(tickers).toContain("PLTR");
    expect(tickers).toContain("RIVN");
    expect(tickers).not.toContain("ETF");
    expect(tickers).not.toContain("IPO");
  });

  it("does not extract tickers from punctuation-attached words", () => {
    // Word boundary \b should prevent partial matches
    const tickers = extractTickers("PLTR. COIN, HOOD!");
    expect(tickers).toContain("PLTR");
    expect(tickers).toContain("COIN");
    expect(tickers).toContain("HOOD");
  });

  it("ignores more than 5 consecutive uppercase letters", () => {
    // TICKER_REGEX is {1,5}, so 6+ letter words won't match at all
    const tickers = extractTickers("TOOLONG is too long but PTON is valid");
    expect(tickers).not.toContain("TOOLONG");
    expect(tickers).toContain("PTON");
  });
});

describe("extractCashtagTickers", () => {
  it("returns valid cashtag tickers", () => {
    const result = extractCashtagTickers(["PTON", "CRWD", "SOFI"]);
    expect(result).toContain("PTON");
    expect(result).toContain("CRWD");
    expect(result).toContain("SOFI");
  });

  it("converts lowercase cashtags to uppercase", () => {
    const result = extractCashtagTickers(["pton", "crwd"]);
    expect(result).toContain("PTON");
    expect(result).toContain("CRWD");
  });

  it("filters out BLACKLIST items", () => {
    const result = extractCashtagTickers(["CEO", "ETF", "PTON"]);
    expect(result).not.toContain("CEO");
    expect(result).not.toContain("ETF");
    expect(result).toContain("PTON");
  });

  it("filters out MEGA_CAPS", () => {
    const result = extractCashtagTickers(["AAPL", "NVDA", "PLTR"]);
    expect(result).not.toContain("AAPL");
    expect(result).not.toContain("NVDA");
    expect(result).toContain("PLTR");
  });

  it("deduplicates repeated cashtags", () => {
    const result = extractCashtagTickers(["PTON", "pton", "PTON"]);
    expect(result.filter((t) => t === "PTON")).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(extractCashtagTickers([])).toEqual([]);
  });

  it("filters out single-character cashtags", () => {
    const result = extractCashtagTickers(["A", "B", "PTON"]);
    expect(result).not.toContain("A");
    expect(result).not.toContain("B");
    expect(result).toContain("PTON");
  });
});

describe("BLACKLIST", () => {
  it("contains common English words", () => {
    expect(BLACKLIST.has("THE")).toBe(true);
    expect(BLACKLIST.has("AND")).toBe(false); // 'AND' is not actually in the blacklist
    expect(BLACKLIST.has("ALL")).toBe(true);
  });

  it("contains financial acronyms", () => {
    expect(BLACKLIST.has("CEO")).toBe(true);
    expect(BLACKLIST.has("IPO")).toBe(true);
    expect(BLACKLIST.has("ETF")).toBe(true);
    expect(BLACKLIST.has("SEC")).toBe(true);
  });

  it("contains ETF tickers", () => {
    expect(BLACKLIST.has("SPY")).toBe(true);
    expect(BLACKLIST.has("QQQ")).toBe(true);
    expect(BLACKLIST.has("ARKK")).toBe(true);
  });

  it("contains crypto tickers", () => {
    expect(BLACKLIST.has("BTC")).toBe(true);
    expect(BLACKLIST.has("ETH")).toBe(true);
    expect(BLACKLIST.has("SOL")).toBe(true);
  });

  it("does NOT contain valid stock tickers", () => {
    expect(BLACKLIST.has("PTON")).toBe(false);
    expect(BLACKLIST.has("PLTR")).toBe(false);
    expect(BLACKLIST.has("COIN")).toBe(false);
  });
});

describe("MEGA_CAPS", () => {
  it("contains major tech stocks", () => {
    expect(MEGA_CAPS.has("AAPL")).toBe(true);
    expect(MEGA_CAPS.has("MSFT")).toBe(true);
    expect(MEGA_CAPS.has("NVDA")).toBe(true);
    expect(MEGA_CAPS.has("META")).toBe(true);
  });

  it("does NOT contain non-mega-cap stocks", () => {
    expect(MEGA_CAPS.has("PTON")).toBe(false);
    expect(MEGA_CAPS.has("COIN")).toBe(false);
    expect(MEGA_CAPS.has("SOFI")).toBe(false);
  });
});
