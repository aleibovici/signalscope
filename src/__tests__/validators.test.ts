import { describe, it, expect } from "vitest";
import {
  paginationSchema,
  addPositionSchema,
  updatePositionSchema,
  symbolSchema,
  symbolsQuerySchema,
} from "@/lib/validators";

// ── paginationSchema ──────────────────────────────────────────────────────────

describe("paginationSchema", () => {
  it("returns defaults when no values provided", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = paginationSchema.parse({ page: "3", limit: "50" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("rejects page < 1", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects limit < 1", () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it("accepts limit of exactly 100", () => {
    const result = paginationSchema.parse({ limit: 100 });
    expect(result.limit).toBe(100);
  });

  it("rejects non-integer page", () => {
    expect(() => paginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

// ── addPositionSchema ─────────────────────────────────────────────────────────

describe("addPositionSchema", () => {
  it("parses valid position", () => {
    const result = addPositionSchema.parse({
      symbol: "pton",
      entryPrice: 15.5,
      shares: 100,
      notes: "Breakout play",
    });
    expect(result.symbol).toBe("PTON");
    expect(result.entryPrice).toBe(15.5);
    expect(result.shares).toBe(100);
  });

  it("transforms symbol to uppercase", () => {
    const result = addPositionSchema.parse({ symbol: "pltr", entryPrice: 20 });
    expect(result.symbol).toBe("PLTR");
  });

  it("makes shares and notes optional", () => {
    const result = addPositionSchema.parse({ symbol: "COIN", entryPrice: 200 });
    expect(result.shares).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("rejects empty symbol", () => {
    expect(() => addPositionSchema.parse({ symbol: "", entryPrice: 10 })).toThrow();
  });

  it("rejects symbol longer than 10 characters", () => {
    expect(() =>
      addPositionSchema.parse({ symbol: "TOOLONGTOBEVALID", entryPrice: 10 })
    ).toThrow();
  });

  it("rejects non-positive entryPrice", () => {
    expect(() => addPositionSchema.parse({ symbol: "PTON", entryPrice: 0 })).toThrow();
    expect(() => addPositionSchema.parse({ symbol: "PTON", entryPrice: -5 })).toThrow();
  });

  it("rejects notes longer than 500 characters", () => {
    expect(() =>
      addPositionSchema.parse({ symbol: "PTON", entryPrice: 10, notes: "x".repeat(501) })
    ).toThrow();
  });

  it("accepts notes of exactly 500 characters", () => {
    const result = addPositionSchema.parse({
      symbol: "PTON",
      entryPrice: 10,
      notes: "x".repeat(500),
    });
    expect(result.notes).toHaveLength(500);
  });

  it("rejects non-positive shares", () => {
    expect(() =>
      addPositionSchema.parse({ symbol: "PTON", entryPrice: 10, shares: 0 })
    ).toThrow();
  });
});

// ── updatePositionSchema ──────────────────────────────────────────────────────

describe("updatePositionSchema", () => {
  it("parses status update to CLOSED", () => {
    const result = updatePositionSchema.parse({ status: "CLOSED", closePrice: 25 });
    expect(result.status).toBe("CLOSED");
    expect(result.closePrice).toBe(25);
  });

  it("parses status update to OPEN", () => {
    const result = updatePositionSchema.parse({ status: "OPEN" });
    expect(result.status).toBe("OPEN");
  });

  it("allows all optional fields to be absent", () => {
    const result = updatePositionSchema.parse({});
    expect(result.status).toBeUndefined();
    expect(result.closePrice).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("rejects closePrice without status CLOSED", () => {
    expect(() =>
      updatePositionSchema.parse({ closePrice: 25 })
    ).toThrow();
  });

  it("rejects closePrice with status OPEN", () => {
    expect(() =>
      updatePositionSchema.parse({ status: "OPEN", closePrice: 25 })
    ).toThrow();
  });

  it("rejects invalid status value", () => {
    expect(() =>
      updatePositionSchema.parse({ status: "PENDING" })
    ).toThrow();
  });

  it("rejects non-positive closePrice", () => {
    expect(() =>
      updatePositionSchema.parse({ status: "CLOSED", closePrice: -1 })
    ).toThrow();
  });
});

// ── symbolSchema ──────────────────────────────────────────────────────────────

describe("symbolSchema", () => {
  it("transforms to uppercase", () => {
    expect(symbolSchema.parse("pton")).toBe("PTON");
  });

  it("accepts valid symbol", () => {
    expect(symbolSchema.parse("COIN")).toBe("COIN");
  });

  it("rejects empty string", () => {
    expect(() => symbolSchema.parse("")).toThrow();
  });

  it("rejects symbol longer than 10 characters", () => {
    expect(() => symbolSchema.parse("TOOLONGNAME")).toThrow();
  });

  it("accepts symbol of exactly 10 characters", () => {
    expect(symbolSchema.parse("ABCDEFGHIJ")).toBe("ABCDEFGHIJ");
  });
});

// ── symbolsQuerySchema ────────────────────────────────────────────────────────

describe("symbolsQuerySchema", () => {
  it("parses comma-separated symbols", () => {
    const result = symbolsQuerySchema.parse("PTON,PLTR,COIN");
    expect(result).toEqual(["PTON", "PLTR", "COIN"]);
  });

  it("trims whitespace around symbols", () => {
    const result = symbolsQuerySchema.parse("PTON , PLTR , COIN");
    expect(result).toEqual(["PTON", "PLTR", "COIN"]);
  });

  it("transforms to uppercase", () => {
    const result = symbolsQuerySchema.parse("pton,pltr");
    expect(result).toEqual(["PTON", "PLTR"]);
  });

  it("parses single symbol", () => {
    const result = symbolsQuerySchema.parse("PTON");
    expect(result).toEqual(["PTON"]);
  });

  it("rejects empty string (no symbols)", () => {
    // After transform: [""] which fails min(1) on each element
    expect(() => symbolsQuerySchema.parse("")).toThrow();
  });

  it("rejects more than 50 symbols", () => {
    const symbols = Array.from({ length: 51 }, (_, i) => `SY${i}`).join(",");
    expect(() => symbolsQuerySchema.parse(symbols)).toThrow();
  });

  it("accepts exactly 50 symbols", () => {
    const symbols = Array.from({ length: 50 }, (_, i) => `S${i}`).join(",");
    const result = symbolsQuerySchema.parse(symbols);
    expect(result).toHaveLength(50);
  });
});
