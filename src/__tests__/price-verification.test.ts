import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceSnapshot: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));

const { verifyPriceAgainstSnapshot } = await import("@/lib/price-verification");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyPriceAgainstSnapshot", () => {
  it("returns true when price is within 5% of snapshot", async () => {
    mockFindFirst.mockResolvedValue({ price: 100 });

    expect(await verifyPriceAgainstSnapshot("AAPL", 103)).toBe(true); // 3% deviation
    expect(await verifyPriceAgainstSnapshot("AAPL", 97)).toBe(true); // 3% deviation
    expect(await verifyPriceAgainstSnapshot("AAPL", 105)).toBe(true); // exactly 5%
    expect(await verifyPriceAgainstSnapshot("AAPL", 95)).toBe(true); // exactly 5%
  });

  it("returns false when price deviates more than 5% from snapshot", async () => {
    mockFindFirst.mockResolvedValue({ price: 100 });

    expect(await verifyPriceAgainstSnapshot("AAPL", 106)).toBe(false); // 6% high
    expect(await verifyPriceAgainstSnapshot("AAPL", 94)).toBe(false); // 6% low
    expect(await verifyPriceAgainstSnapshot("AAPL", 150)).toBe(false); // 50% high
    expect(await verifyPriceAgainstSnapshot("AAPL", 50)).toBe(false); // 50% low
  });

  it("returns true when no snapshot exists (benefit of the doubt)", async () => {
    mockFindFirst.mockResolvedValue(null);

    expect(await verifyPriceAgainstSnapshot("UNKNOWN", 999)).toBe(true);
  });

  it("returns true for exact match", async () => {
    mockFindFirst.mockResolvedValue({ price: 42.5 });

    expect(await verifyPriceAgainstSnapshot("XYZ", 42.5)).toBe(true);
  });

  it("queries latest snapshot by symbol", async () => {
    mockFindFirst.mockResolvedValue({ price: 100 });

    await verifyPriceAgainstSnapshot("NVDA", 100);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { symbol: "NVDA" },
      orderBy: { createdAt: "desc" },
      select: { price: true },
    });
  });
});
