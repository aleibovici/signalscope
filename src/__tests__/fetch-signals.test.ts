import { describe, it, expect, vi } from "vitest";
import type { RawSignal } from "@/lib/harvester/types";

// Mock all harvester deps
vi.mock("@/lib/prisma", () => ({ prisma: {}, createDevPrismaClient: vi.fn() }));

const mockFetchReddit = vi.fn();
const mockFetchStockTwits = vi.fn();
const mockFetchSecInsider = vi.fn();
const mockFetchOptionsFlow = vi.fn();
const mockFetchVolumeSpike = vi.fn();
const mockFetchTwitter = vi.fn();

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
vi.mock("@/lib/harvester/scoring", () => ({ scoreSymbolBatch: vi.fn() }));
vi.mock("@/lib/harvester/pnd-filter", () => ({ checkPndFlags: vi.fn(), aiPndAssessment: vi.fn() }));
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
  it("aggregates signals from all sources", async () => {
    mockFetchReddit.mockResolvedValue([sig("AAPL"), sig("TSLA")]);
    mockFetchStockTwits.mockResolvedValue([sig("AAPL", "STOCKTWITS")]);
    mockFetchSecInsider.mockResolvedValue([sig("NVDA", "SEC_INSIDER")]);
    mockFetchOptionsFlow.mockResolvedValue([]);
    mockFetchVolumeSpike.mockResolvedValue([sig("TSLA", "VOLUME_SPIKE")]);
    mockFetchTwitter.mockResolvedValue([sig("GME", "TWITTER")]);

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

    const signals = await fetchSignals();

    // Reddit failed but others succeeded
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.symbol).sort()).toEqual(["AAPL", "NVDA"]);
  });

  it("handles all sources failing", async () => {
    mockFetchReddit.mockRejectedValue(new Error("down"));
    mockFetchStockTwits.mockRejectedValue(new Error("down"));
    mockFetchSecInsider.mockRejectedValue(new Error("down"));
    mockFetchOptionsFlow.mockRejectedValue(new Error("down"));
    mockFetchVolumeSpike.mockRejectedValue(new Error("down"));
    mockFetchTwitter.mockRejectedValue(new Error("down"));

    const signals = await fetchSignals();
    expect(signals).toEqual([]);
  });
});
