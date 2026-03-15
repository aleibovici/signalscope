import { beforeEach, describe, expect, it, vi } from "vitest";

const mockScanFindFirst = vi.fn();
const mockValidatedTickerFindMany = vi.fn();
const mockSendTickerAlerts = vi.fn();
const mockSendPortfolioAlerts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scan: {
      findFirst: (...args: unknown[]) => mockScanFindFirst(...args),
    },
    validatedTicker: {
      findMany: (...args: unknown[]) => mockValidatedTickerFindMany(...args),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendTickerAlerts: (...args: unknown[]) => mockSendTickerAlerts(...args),
  sendPortfolioAlerts: (...args: unknown[]) => mockSendPortfolioAlerts(...args),
}));

const { POST: postSend } = await import("@/app/api/alerts/send/route");
const { POST: postPortfolio } = await import("@/app/api/alerts/portfolio/route");

function makePostRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers,
  });
}

describe("alerts endpoint auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SNAPSHOT_API_KEY", "test-snapshot-key");
  });

  describe("POST /api/alerts/send", () => {
    it("returns 401 when x-snapshot-key is missing", async () => {
      const res = await postSend(makePostRequest("/api/alerts/send"));
      expect(res.status).toBe(401);
      expect(mockScanFindFirst).not.toHaveBeenCalled();
      expect(mockSendTickerAlerts).not.toHaveBeenCalled();
    });

    it("returns 401 when x-snapshot-key is invalid", async () => {
      const res = await postSend(
        makePostRequest("/api/alerts/send", { "x-snapshot-key": "wrong-key" })
      );
      expect(res.status).toBe(401);
      expect(mockScanFindFirst).not.toHaveBeenCalled();
      expect(mockSendTickerAlerts).not.toHaveBeenCalled();
    });

    it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
      vi.stubEnv("SNAPSHOT_API_KEY", "");
      const res = await postSend(
        makePostRequest("/api/alerts/send", { "x-snapshot-key": "any-key" })
      );
      expect(res.status).toBe(503);
      expect(mockScanFindFirst).not.toHaveBeenCalled();
    });

    it("allows request with valid key", async () => {
      mockScanFindFirst.mockResolvedValue({ id: "scan_1" });
      mockValidatedTickerFindMany.mockResolvedValue([
        {
          symbol: "AAPL",
          price: 190,
          aiScore: 83,
          catalyst: "Insider buying",
          signalType: "insider_buy",
          stage: "EARLY",
          opportunityScore: 91,
        },
      ]);
      mockSendTickerAlerts.mockResolvedValue(undefined);

      const res = await postSend(
        makePostRequest("/api/alerts/send", { "x-snapshot-key": "test-snapshot-key" })
      );
      expect(res.status).toBe(200);
      expect(mockScanFindFirst).toHaveBeenCalled();
      expect(mockSendTickerAlerts).toHaveBeenCalled();
    });
  });

  describe("POST /api/alerts/portfolio", () => {
    it("returns 401 when x-snapshot-key is missing", async () => {
      const res = await postPortfolio(makePostRequest("/api/alerts/portfolio"));
      expect(res.status).toBe(401);
      expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
    });

    it("returns 401 when x-snapshot-key is invalid", async () => {
      const res = await postPortfolio(
        makePostRequest("/api/alerts/portfolio", { "x-snapshot-key": "wrong-key" })
      );
      expect(res.status).toBe(401);
      expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
    });

    it("returns 503 when SNAPSHOT_API_KEY is not configured", async () => {
      vi.stubEnv("SNAPSHOT_API_KEY", "");
      const res = await postPortfolio(
        makePostRequest("/api/alerts/portfolio", { "x-snapshot-key": "any-key" })
      );
      expect(res.status).toBe(503);
      expect(mockSendPortfolioAlerts).not.toHaveBeenCalled();
    });
  });
});
