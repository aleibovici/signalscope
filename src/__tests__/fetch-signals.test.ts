import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";

// Mock all harvester deps
vi.mock("@/lib/prisma", () => ({ prisma: {}, createDevPrismaClient: vi.fn() }));

const mockFetchReddit = vi.fn();
const mockFetchStockTwits = vi.fn();
const mockFetchSecInsider = vi.fn();
const mockFetchOptionsFlow = vi.fn();
const mockFetchVolumeSpike = vi.fn();
const mockFetchTwitter = vi.fn();
const mockFetchCongress = vi.fn();
const mockFetchPolymarket = vi.fn();

vi.mock("@/lib/harvester/sources/reddit", () => ({
  fetchRedditSignals: (...args: unknown[]) => mockFetchReddit(...args),
}));
vi.mock("@/lib/harvester/sources/stocktwits", () => ({
  fetchStockTwitsSignals: (...args: unknown[]) => mockFetchStockTwits(...args),
}));
vi.mock("@/lib/harvester/sources/sec-insider", () => ({
  fetchSecInsiderSignals: (...args: unknown[]) => mockFetchSecInsider(...args),
}));
vi.mock("@/lib/harvester/sources/options-flow", () => ({
  fetchOptionsFlowSignals: (...args: unknown[]) => mockFetchOptionsFlow(...args),
}));
vi.mock("@/lib/harvester/sources/volume-spike", () => ({
  fetchVolumeSpikeSignals: (...args: unknown[]) => mockFetchVolumeSpike(...args),
}));
vi.mock("@/lib/harvester/sources/twitter", () => ({
  fetchTwitterSignals: (...args: unknown[]) => mockFetchTwitter(...args),
}));
vi.mock("@/lib/harvester/sources/congress", () => ({
  fetchCongressSignals: (...args: unknown[]) => mockFetchCongress(...args),
}));
vi.mock("@/lib/harvester/sources/polymarket", () => ({
  fetchPolymarketSignals: (...args: unknown[]) => mockFetchPolymarket(...args),
}));
vi.mock("@/lib/harvester/scoring", () => ({ scoreSymbolBatch: vi.fn() }));
vi.mock("@/lib/harvester/pnd-filter", () => ({ checkPndFlags: vi.fn(), aiPndAssessment: vi.fn(), PND_THRESHOLD: 3, INFORMATIONAL_FLAGS: new Set(["penny_price", "otc_listing", "twitter_coordinated_pump", "coordinated_posts", "single_source"]) }));
vi.mock("@/lib/harvester/fundamentals", () => ({ fetchFundamentals: vi.fn() }));
vi.mock("@/lib/harvester/report", () => ({ generateTickerReport: vi.fn() }));
vi.mock("@/lib/ai", () => ({
  resetCostTracker: vi.fn(),
  getTotalCost: vi.fn(() => 0),
  chatJSON: vi.fn(),
}));

const { fetchSignals } = await import("@/lib/harvester/index");

function sig(symbol: string, source: RawSignal["source"] = "REDDIT"): RawSignal {
  return { symbol, source };
}

describe("fetchSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates signals from all sources", async () => {
    mockFetchReddit.mockResolvedValue([sig("AAPL"), sig("TSLA")]);
    mockFetchStockTwits.mockResolvedValue([sig("AAPL", "STOCKTWITS")]);
    mockFetchSecInsider.mockResolvedValue([sig("NVDA", "SEC_INSIDER")]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([sig("TSLA", "VOLUME_SPIKE")]);
    mockFetchTwitter.mockResolvedValue([sig("GME", "TWITTER")]);
    mockFetchCongress.mockResolvedValue([]);
    mockFetchPolymarket.mockResolvedValue([]);

    const signals = await fetchSignals();

    expect(signals).toHaveLength(6);
    expect(signals.map((s) => s.symbol).sort()).toEqual(["AAPL", "AAPL", "GME", "NVDA", "TSLA", "TSLA"].sort());
  });

  it("returns empty array when all sources return empty", async () => {
    mockFetchReddit.mockResolvedValue([]);
    mockFetchStockTwits.mockResolvedValue([]);
    mockFetchSecInsider.mockResolvedValue([]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([]);
    mockFetchTwitter.mockResolvedValue([]);
    mockFetchCongress.mockResolvedValue([]);
    mockFetchPolymarket.mockResolvedValue([]);

    const signals = await fetchSignals();
    expect(signals).toEqual([]);
  });

  it("gracefully handles source failures", async () => {
    mockFetchReddit.mockRejectedValue(new Error("Reddit down"));
    mockFetchStockTwits.mockResolvedValue([]);
    mockFetchSecInsider.mockResolvedValue([sig("NVDA", "SEC_INSIDER")]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([]);
    mockFetchTwitter.mockResolvedValue([sig("AAPL", "TWITTER")]);
    mockFetchCongress.mockResolvedValue([]);
    mockFetchPolymarket.mockResolvedValue([]);

    const signals = await fetchSignals();

    // Reddit failed but others succeeded
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.symbol).sort()).toEqual(["AAPL", "NVDA"]);
  });

  it("runs Polymarket phase 2 for symbols not in SCAN_SYMBOLS", async () => {
    // Phase 1: other sources discover "ZZZZ" which is not in SCAN_SYMBOLS
    mockFetchReddit.mockResolvedValue([sig("ZZZZ")]);
    mockFetchStockTwits.mockResolvedValue([]);
    mockFetchSecInsider.mockResolvedValue([]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([]);
    mockFetchTwitter.mockResolvedValue([]);
    mockFetchCongress.mockResolvedValue([]);
    // Phase 1 polymarket returns nothing
    mockFetchPolymarket.mockResolvedValueOnce([]);
    // Phase 2 polymarket called with extra symbols
    mockFetchPolymarket.mockResolvedValueOnce([sig("ZZZZ", "POLYMARKET")]);

    const signals = await fetchSignals();

    // Phase 1 polymarket called without args (SCAN_SYMBOLS)
    expect(mockFetchPolymarket).toHaveBeenCalledTimes(2);
    // Phase 2 called with ["ZZZZ"] since it's not in SCAN_SYMBOLS
    expect(mockFetchPolymarket.mock.calls[1][0]).toEqual(["ZZZZ"]);
    // Total: 1 reddit + 1 polymarket phase 2
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.source)).toContain("POLYMARKET");
  });

  it("skips Polymarket phase 2 when no extra symbols", async () => {
    // Only AAPL which IS in SCAN_SYMBOLS
    mockFetchReddit.mockResolvedValue([sig("AAPL")]);
    mockFetchStockTwits.mockResolvedValue([]);
    mockFetchSecInsider.mockResolvedValue([]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([]);
    mockFetchTwitter.mockResolvedValue([]);
    mockFetchCongress.mockResolvedValue([]);
    mockFetchPolymarket.mockResolvedValue([]);

    await fetchSignals();

    // Phase 1 only — no phase 2 since AAPL is in SCAN_SYMBOLS
    expect(mockFetchPolymarket).toHaveBeenCalledTimes(1);
  });

  it("handles all sources failing", async () => {
    mockFetchReddit.mockRejectedValue(new Error("down"));
    mockFetchStockTwits.mockRejectedValue(new Error("down"));
    mockFetchSecInsider.mockRejectedValue(new Error("down"));
    mockFetchOptionsFlow.mockRejectedValue(new Error("down"));
    mockFetchVolumeSpike.mockRejectedValue(new Error("down"));
    mockFetchTwitter.mockRejectedValue(new Error("down"));
    mockFetchCongress.mockRejectedValue(new Error("down"));
    mockFetchPolymarket.mockRejectedValue(new Error("down"));

    const signals = await fetchSignals();
    expect(signals).toEqual([]);
  });
});
