import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchVolumeData } = await import(
  "@/lib/harvester/sources/volume-spike"
);

function chartResponse(
  symbol: string,
  volumes: (number | null)[],
  regularMarketVolume?: number
) {
  return {
    ok: true,
    json: async () => ({
      chart: {
        result: [
          {
            meta: {
              symbol,
              ...(regularMarketVolume != null
                ? { regularMarketVolume }
                : {}),
            },
            indicators: { quote: [{ volume: volumes }] },
          },
        ],
      },
    }),
  };
}

describe("fetchVolumeData — volume average computation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes average from historical bars when meta.averageDailyVolume10Day is absent", async () => {
    // 5 prior days + 1 current day
    const volumes = [100, 200, 300, 400, 500, 1000];
    mockFetch.mockResolvedValueOnce(chartResponse("TEST", volumes, 1000));

    const result = await fetchVolumeData("TEST");

    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("TEST");
    expect(result!.regularMarketVolume).toBe(1000);
    // Average of [100, 200, 300, 400, 500] = 300
    expect(result!.averageDailyVolume10Day).toBe(300);
  });

  it("uses meta.regularMarketVolume when available", async () => {
    const volumes = [100, 200, 300];
    mockFetch.mockResolvedValueOnce(chartResponse("TSLA", volumes, 999));

    const result = await fetchVolumeData("TSLA");

    expect(result!.regularMarketVolume).toBe(999);
  });

  it("falls back to last volume bar when meta.regularMarketVolume is absent", async () => {
    const volumes = [100, 200, 500];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: { symbol: "XYZ" },
              indicators: { quote: [{ volume: volumes }] },
            },
          ],
        },
      }),
    });

    const result = await fetchVolumeData("XYZ");

    expect(result!.regularMarketVolume).toBe(500);
  });

  it("filters out null and zero volumes", async () => {
    // Only 100, 200, 600 are valid
    const volumes = [null, 0, 100, null, 200, 600];
    mockFetch.mockResolvedValueOnce(chartResponse("ABC", volumes, 600));

    const result = await fetchVolumeData("ABC");

    expect(result!.regularMarketVolume).toBe(600);
    // Average of [100, 200] = 150
    expect(result!.averageDailyVolume10Day).toBe(150);
  });

  it("returns null when fewer than 2 valid volumes", async () => {
    mockFetch.mockResolvedValueOnce(chartResponse("ONE", [500], 500));

    const result = await fetchVolumeData("ONE");

    expect(result).toBeNull();
  });

  it("returns null when all volumes are null/zero", async () => {
    mockFetch.mockResolvedValueOnce(chartResponse("EMPTY", [null, 0, null], 0));

    const result = await fetchVolumeData("EMPTY");

    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchVolumeData("FAIL");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const result = await fetchVolumeData("TIMEOUT");

    expect(result).toBeNull();
  });

  it("returns null when chart result is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chart: { result: [] } }),
    });

    const result = await fetchVolumeData("NORESULT");

    expect(result).toBeNull();
  });

  it("correctly identifies a 2x spike", async () => {
    // Prior 10 days avg = 1M, current = 2.5M → ratio 2.5x
    const prior = Array(10).fill(1_000_000);
    const volumes = [...prior, 2_500_000];
    mockFetch.mockResolvedValueOnce(chartResponse("SPIKE", volumes, 2_500_000));

    const result = await fetchVolumeData("SPIKE");

    expect(result!.regularMarketVolume).toBe(2_500_000);
    expect(result!.averageDailyVolume10Day).toBe(1_000_000);
    // Ratio would be 2.5x — above threshold
    const ratio = result!.regularMarketVolume / result!.averageDailyVolume10Day;
    expect(ratio).toBe(2.5);
  });

  it("fetches with 15d range to get enough historical data", async () => {
    mockFetch.mockResolvedValueOnce(chartResponse("CHK", [100, 200], 200));

    await fetchVolumeData("CHK");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("range=15d"),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("interval=1d"),
      expect.any(Object)
    );
  });
});
