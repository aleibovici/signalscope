import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

// Prisma mock — only the calls the sync route makes
const mockBrokerOrderFindMany = vi.fn().mockResolvedValue([]);
const mockBrokerOrderFindFirst = vi.fn();
const mockBrokerOrderUpdate = vi.fn().mockResolvedValue({});
const mockBrokerOrderCreate = vi.fn().mockResolvedValue({});
const mockBrokerPositionFindMany = vi.fn();
const mockBrokerPositionUpsert = vi.fn().mockResolvedValue({});
const mockBrokerPositionUpdate = vi.fn().mockResolvedValue({});
const mockScanFindFirst = vi.fn().mockResolvedValue(null);
const mockValidatedTickerFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brokerOrder: {
      findMany: (...a: unknown[]) => mockBrokerOrderFindMany(...a),
      findFirst: (...a: unknown[]) => mockBrokerOrderFindFirst(...a),
      update: (...a: unknown[]) => mockBrokerOrderUpdate(...a),
      create: (...a: unknown[]) => mockBrokerOrderCreate(...a),
    },
    brokerPosition: {
      findMany: (...a: unknown[]) => mockBrokerPositionFindMany(...a),
      upsert: (...a: unknown[]) => mockBrokerPositionUpsert(...a),
      update: (...a: unknown[]) => mockBrokerPositionUpdate(...a),
    },
    scan: {
      findFirst: (...a: unknown[]) => mockScanFindFirst(...a),
    },
    validatedTicker: {
      findMany: (...a: unknown[]) => mockValidatedTickerFindMany(...a),
    },
  },
}));

const mockListOpenOrders = vi.fn().mockResolvedValue([]);
const mockListPositions = vi.fn().mockResolvedValue([]);
const mockPlaceMarketSell = vi.fn().mockResolvedValue(undefined);
const mockCancelOrder = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/brokers/factory", () => ({
  getBrokerClient: () => ({
    provider: "alpaca",
    listOpenOrders: mockListOpenOrders,
    listPositions: mockListPositions,
    placeMarketSell: mockPlaceMarketSell,
    cancelOrder: mockCancelOrder,
  }),
  isConfigured: () => true,
}));

import { POST } from "@/app/api/brokers/ibkr/sync/route";
import { TickerStage } from "@/generated/prisma/client";

function buildRequest(): NextRequest {
  return new NextRequest("http://test/api/brokers/ibkr/sync", {
    method: "POST",
    headers: { "x-snapshot-key": "test-snapshot-key" },
  });
}

function position(symbol: string, daysOld: number) {
  return {
    symbol,
    quantity: 10,
    avgCost: 100,
    openedAt: new Date(Date.now() - daysOld * 86400000),
    closedAt: null,
    syncedAt: new Date(),
  };
}

function parentOrder(stage: TickerStage) {
  return {
    id: "ord-" + stage,
    validatedTickerId: "vt-" + stage,
    validatedTicker: { stage },
    placedAt: new Date(),
  };
}

beforeEach(() => {
  mockBrokerOrderFindMany.mockReset().mockResolvedValue([]);
  mockBrokerOrderFindFirst.mockReset();
  mockBrokerOrderUpdate.mockReset().mockResolvedValue({});
  mockBrokerOrderCreate.mockReset().mockResolvedValue({});
  mockBrokerPositionFindMany.mockReset();
  mockBrokerPositionUpsert.mockReset().mockResolvedValue({});
  mockBrokerPositionUpdate.mockReset().mockResolvedValue({});
  mockScanFindFirst.mockReset().mockResolvedValue(null);
  mockValidatedTickerFindMany.mockReset().mockResolvedValue([]);
  mockListOpenOrders.mockReset().mockResolvedValue([]);
  mockListPositions.mockReset().mockResolvedValue([]);
  mockPlaceMarketSell.mockReset().mockResolvedValue(undefined);
});

describe("sync route — stage-based time exit", () => {
  it("rejects without snapshot key", async () => {
    const req = new NextRequest("http://test/api/brokers/ibkr/sync", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("exits EARLY position at day 5 (not day 7)", async () => {
    // Position opened 6 days ago, EARLY stage — should exit (5d cap)
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([]) // first call: closed-position detection
      .mockResolvedValueOnce([position("EARLY1", 6)]); // second call: still-open scan
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { role?: string } }) => {
      if (args.where.role === "PARENT") return parentOrder(TickerStage.EARLY);
      if (args.where.role === "EXIT_TIMEOUT") return null;
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timeExits).toBe(1);
    expect(mockPlaceMarketSell).toHaveBeenCalledWith("EARLY1", 10);
  });

  it("does NOT exit EARLY position at day 4 (under 5d cap)", async () => {
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("EARLY2", 4)]);
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { role?: string } }) => {
      if (args.where.role === "PARENT") return parentOrder(TickerStage.EARLY);
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(body.timeExits).toBe(0);
    expect(mockPlaceMarketSell).not.toHaveBeenCalled();
  });

  it("holds CONFIRMED position at day 6 (under 7d cap)", async () => {
    // CONFIRMED gets 7 days — at day 6 it should NOT exit
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("CONF1", 6)]);
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { role?: string } }) => {
      if (args.where.role === "PARENT") return parentOrder(TickerStage.CONFIRMED);
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(body.timeExits).toBe(0);
    expect(mockPlaceMarketSell).not.toHaveBeenCalled();
  });

  it("exits CONFIRMED position at day 8 (over 7d cap)", async () => {
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("CONF2", 8)]);
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { role?: string } }) => {
      if (args.where.role === "PARENT") return parentOrder(TickerStage.CONFIRMED);
      if (args.where.role === "EXIT_TIMEOUT") return null;
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(body.timeExits).toBe(1);
    expect(mockPlaceMarketSell).toHaveBeenCalledWith("CONF2", 10);
  });

  it("differentiates: EARLY exits at 6d, CONFIRMED holds at 6d in same run", async () => {
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("EARLY3", 6), position("CONF3", 6)]);
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { symbol?: string; role?: string } }) => {
      if (args.where.role === "EXIT_TIMEOUT") return null;
      if (args.where.role !== "PARENT") return null;
      if (args.where.symbol === "EARLY3") return parentOrder(TickerStage.EARLY);
      if (args.where.symbol === "CONF3") return parentOrder(TickerStage.CONFIRMED);
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(body.timeExits).toBe(1);
    expect(mockPlaceMarketSell).toHaveBeenCalledTimes(1);
    expect(mockPlaceMarketSell).toHaveBeenCalledWith("EARLY3", 10);
    expect(mockPlaceMarketSell).not.toHaveBeenCalledWith("CONF3", expect.anything());
  });

  it("falls back to DEFAULT_HOLD_DAYS (5) when parent order has no stage", async () => {
    // Orphan position — no parent order found, so no stage available
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("ORPHAN", 6)]);
    mockBrokerOrderFindFirst.mockResolvedValue(null);

    const res = await POST(buildRequest());
    const body = await res.json();

    // Day 6 > default 5d → should exit
    expect(body.timeExits).toBe(1);
    expect(mockPlaceMarketSell).toHaveBeenCalledWith("ORPHAN", 10);
  });

  it("skips time exit when EXIT_TIMEOUT order already exists (idempotent)", async () => {
    mockBrokerPositionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([position("EARLY4", 10)]);
    mockBrokerOrderFindFirst.mockImplementation((args: { where: { role?: string } }) => {
      if (args.where.role === "PARENT") return parentOrder(TickerStage.EARLY);
      if (args.where.role === "EXIT_TIMEOUT") return { id: "already-submitted" };
      return null;
    });

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(body.timeExits).toBe(0);
    expect(mockPlaceMarketSell).not.toHaveBeenCalled();
  });
});
