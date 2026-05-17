import { prisma } from "@/lib/prisma";
import { fetchCurrentPrice } from "@/lib/harvester/fundamentals";

export type ToolName = "get_all_signals" | "get_current_price" | "get_performance" | "get_history" | "get_peer_context" | "get_price_snapshots";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolResult {
  tool: string;
  result: unknown;
  error?: string;
}

const MAX_SIGNALS = 20;
const MAX_PEERS = 8;
const MAX_SNAPSHOTS = 30;

// --- Tool definitions (sent to AI in system prompt) ---

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_all_signals",
    description:
      "Get all raw signals for this ticker from the current scan. Returns source, title, upvotes, comments, subreddit, author, postAge, insider/options fields. Sorted by velocity score descending, capped at 20.",
    parameters: {
      symbol: { type: "string", description: "Ticker symbol", required: true },
      scanId: { type: "string", description: "Current scan ID", required: true },
    },
  },
  {
    name: "get_current_price",
    description:
      "Fetch live price from Yahoo Finance. Use when fundamentals are stale or missing fields.",
    parameters: {
      symbol: { type: "string", description: "Ticker symbol", required: true },
    },
  },
  {
    name: "get_performance",
    description:
      "Get historical return data (1d, 3d, 7d, 30d) for this ticker from past scans. Shows how previous detections performed.",
    parameters: {
      symbol: { type: "string", description: "Ticker symbol", required: true },
    },
  },
  {
    name: "get_history",
    description:
      "Get prior scan appearances for this ticker with score and stage progression over time.",
    parameters: {
      symbol: { type: "string", description: "Ticker symbol", required: true },
    },
  },
  {
    name: "get_peer_context",
    description:
      "Find similar tickers from the last 7 days by sector and market cap range. Shows how peers scored and performed.",
    parameters: {
      sector: { type: "string", description: "Sector to match (e.g. 'Technology')", required: true },
      marketCapRange: {
        type: "string",
        description: "Market cap bucket: 'micro' (<300M), 'small' (300M-2B), 'mid' (2B-10B), 'large' (>10B)",
        required: true,
      },
    },
  },
  {
    name: "get_price_snapshots",
    description:
      "Get recent price time-series (last 30 days) for this ticker. Sampled to ~30 data points.",
    parameters: {
      symbol: { type: "string", description: "Ticker symbol", required: true },
    },
  },
];

// --- Market cap range helpers ---

function marketCapBounds(range: string): { min: number; max: number } {
  switch (range) {
    case "micro":
      return { min: 0, max: 300_000_000 };
    case "small":
      return { min: 300_000_000, max: 2_000_000_000 };
    case "mid":
      return { min: 2_000_000_000, max: 10_000_000_000 };
    case "large":
      return { min: 10_000_000_000, max: Number.MAX_SAFE_INTEGER };
    default:
      return { min: 0, max: Number.MAX_SAFE_INTEGER };
  }
}

// --- Tool implementations ---

async function getAllSignals(symbol: string, scanId: string) {
  const signals = await prisma.signal.findMany({
    where: { symbol, scanId },
    orderBy: { velocityScore: "desc" },
    take: MAX_SIGNALS,
    select: {
      source: true,
      title: true,
      upvotes: true,
      commentCount: true,
      subreddit: true,
      author: true,
      postAge: true,
      sortType: true,
      velocityScore: true,
      insiderTitle: true,
      purchaseValue: true,
      volumeRatio: true,
      followerCount: true,
      retweetCount: true,
      likeCount: true,
      tweetType: true,
      url: true,
    },
  });
  return { count: signals.length, signals };
}

async function getCurrentPrice(symbol: string) {
  const price = await fetchCurrentPrice(symbol);
  return { symbol, price, fetchedAt: new Date().toISOString() };
}

async function getPerformance(symbol: string) {
  const perfs = await prisma.tickerPerformance.findMany({
    where: { symbol },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      detectionPrice: true,
      return1d: true,
      return3d: true,
      return7d: true,
      return14d: true,
      return30d: true,
      createdAt: true,
    },
  });
  return { symbol, records: perfs };
}

async function getHistory(symbol: string) {
  const history = await prisma.validatedTicker.findMany({
    where: { symbol },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      aiScore: true,
      opportunityScore: true,
      stage: true,
      signalCount: true,
      sourceCount: true,
      price: true,
      recommendation: true,
      signalType: true,
      createdAt: true,
    },
  });
  return { symbol, appearances: history };
}

async function getPeerContext(sector: string, marketCapRange: string) {
  const { min, max } = marketCapBounds(marketCapRange);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const peers = await prisma.validatedTicker.findMany({
    where: {
      sector,
      marketCap: { gte: min, lte: max },
      createdAt: { gte: sevenDaysAgo },
      stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
    },
    orderBy: { opportunityScore: "desc" },
    take: MAX_PEERS,
    select: {
      symbol: true,
      aiScore: true,
      opportunityScore: true,
      stage: true,
      price: true,
      marketCap: true,
      recommendation: true,
      performance: {
        select: {
          return1d: true,
          return3d: true,
          return7d: true,
        },
      },
    },
  });
  return { sector, marketCapRange, peers };
}

async function getPriceSnapshots(symbol: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.priceSnapshot.findMany({
    where: { symbol, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "asc" },
    take: MAX_SNAPSHOTS * 4,
    select: { price: true, createdAt: true },
  });

  // Sample down to MAX_SNAPSHOTS if needed
  if (snapshots.length <= MAX_SNAPSHOTS) {
    return { symbol, snapshots };
  }

  const stride = (snapshots.length - 1) / (MAX_SNAPSHOTS - 1);
  const sampled = Array.from({ length: MAX_SNAPSHOTS }, (_, i) =>
    snapshots[Math.round(i * stride)]
  );

  return { symbol, snapshots: sampled };
}

// --- Registry ---

type ToolExecutor = (params: Record<string, string>) => Promise<unknown>;

export const TOOL_REGISTRY: Record<ToolName, ToolExecutor> = {
  get_all_signals: (p) => getAllSignals(p.symbol, p.scanId),
  get_current_price: (p) => getCurrentPrice(p.symbol),
  get_performance: (p) => getPerformance(p.symbol),
  get_history: (p) => getHistory(p.symbol),
  get_peer_context: (p) => getPeerContext(p.sector, p.marketCapRange),
  get_price_snapshots: (p) => getPriceSnapshots(p.symbol),
};
