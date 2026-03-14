import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");

const mockScanFindFirst = vi.fn();
const mockTickerFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: { findFirst: (...args: unknown[]) => mockScanFindFirst(...args) },
    validatedTicker: { findMany: (...args: unknown[]) => mockTickerFindMany(...args) },
  },
}));

const mockSendTickerAlerts = vi.fn();
const mockSendPortfolioAlerts = vi.fn();
vi.mock("@/lib/email", () => ({
  sendTickerAlerts: (...args: unknown[]) => mockSendTickerAlerts(...args),
  sendPortfolioAlerts: (...args: unknown[]) => mockSendPortfolioAlerts(...args),
}));

const { POST: sendAlertsPOST } = await import("@/app/api/alerts/send/route");
const { POST: portfolioAlertsPOST } = await import("@/app/api/alerts/portfolio/route");

function makeRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers });
}

describe("alerts endpoints auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  });

  describe("POST /api/alerts/send", () => {
    it("returns 401 when x-snapshot-key is missing", async () => {
      const res = await sendAlertsPOST(makeRequest("/api/alerts/send"));
      expect(res.status).toBe(401);
      expect(mockScanFindFirst).not.toHaveBeenCalled();
      expect(mockSendTickerAlerts).not.toHaveBeenCalled();
    });

    it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
      vi.stubEnv("SNAPSHOT_API_KEY", "");
      const res = await sendAlertsPOST(makeRequest("/api/alerts/send", { "x-snapshot-key": "any-key" }));
      expect(res.status).toBe(503);
      expect(mockScanFindFirst).not.toHaveBeenCalled();
    });

    it("sends alerts when x-snapshot-key is valid", async () => {
      mockScanFindFirst.mockResolvedValue({ id: "scan_123", completedAt: new Date("2026-03-14T00:00:00.000Z") });
      mockTickerFindMany.mockResolvedValue([]);
      mockSendTickerAlerts.mockResolvedValue(undefined);

      const res = await sendAlertsPOST(
        makeRequest("/api/alerts/send", { "x-snapshot-key": "test-snapshot-key" })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("sent");
      expect(mockScanFindFirst).toHaveBeenCalledTimes(1);
      expect(mockSendTickerAlerts).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/alerts/portfolio", () => {
    it("returns 401 when x-snapshot-key is missing", async () => {
      const res = await portfolioAlertsPOST(makeRequest("/api/alerts/portfolio"));
      expect(res.status).toBe(401);
      expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
    });

    it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
      vi.stubEnv("SNAPSHOT_API_KEY", "");
      const res = await portfolioAlertsPOST(makeRequest("/api/alerts/portfolio", { "x-snapshot-key": "any-key" }));
      expect(res.status).toBe(503);
      expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
    });

    it("sends portfolio alerts when x-snapshot-key is valid", async () => {
      mockSendPortfolioAlerts.mockResolvedValue({ usersNotified: 2, tickersMatched: 3 });

      const res = await portfolioAlertsPOST(
        makeRequest("/api/alerts/portfolio", { "x-snapshot-key": "test-snapshot-key" })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("sent");
      expect(body.usersNotified).toBe(2);
      expect(body.tickersMatched).toBe(3);
      expect(mockSendPortfolioAlerts).toHaveBeenCalledTimes(1);
    });
  });
});
