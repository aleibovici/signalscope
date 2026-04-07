import { prisma } from "@/lib/prisma";
import { postTweet, type TweetResult } from "./post";

/* ------------------------------------------------------------------ */
/*  Performance tweet — "We flagged $XYZ 7 days ago — up 23%"         */
/*  Builds trust by showing proof of past successful calls.            */
/* ------------------------------------------------------------------ */

export interface PerformanceHit {
  symbol: string;
  recommendation: string;
  stage: string;
  aiScore: number;
  opportunityScore: number;
  detectionPrice: number;
  returnPct: number;
  period: "1d" | "3d" | "7d" | "30d";
  periodLabel: string;
  catalyst: string | null;
  sector: string | null;
  marketCap: number | null;
  detectedAt: Date;
}

const PERIOD_LABELS: Record<string, string> = {
  "1d": "24 hours",
  "3d": "3 days",
  "7d": "7 days",
  "30d": "30 days",
};

/* ------------------------------------------------------------------ */
/*  Query: find top performers from recent scans                       */
/* ------------------------------------------------------------------ */

/** Minimum return thresholds per period to qualify as "noteworthy" */
const MIN_RETURN: Record<string, number> = {
  "1d": 0.05,   // 5% in 1 day
  "3d": 0.08,   // 8% in 3 days
  "7d": 0.10,   // 10% in 7 days
  "30d": 0.15,  // 15% in 30 days
};

/** Returns above 100% are almost always corporate actions (reverse splits) or data errors */
const MAX_RETURN = 1.0;

/** Don't re-tweet the same ticker within this cooldown window */
const COOLDOWN_DAYS = 7;

export async function findTopPerformers(maxResults = 5): Promise<PerformanceHit[]> {
  // Look at performance records from the last 35 days with actual return data
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.tickerPerformance.findMany({
    where: {
      createdAt: { gte: cutoff },
      corporateActionDetected: false,
      // Skip tickers already tweeted in the cooldown window
      OR: [
        { performanceTweetedAt: null },
        { performanceTweetedAt: { lt: cooldownCutoff } },
      ],
      validatedTicker: {
        recommendation: { in: ["Strong Buy", "Buy", "Watch"] },
        pndFlagged: false,
        stage: { in: ["EARLY", "FORMING", "CONFIRMED"] },
      },
    },
    include: {
      validatedTicker: {
        select: {
          symbol: true,
          recommendation: true,
          stage: true,
          aiScore: true,
          opportunityScore: true,
          catalyst: true,
          sector: true,
          marketCap: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200, // broad pool, we'll pick the best
  });

  // For each row, find the best return period that exceeds our threshold
  const hits: PerformanceHit[] = [];

  for (const row of rows) {
    const t = row.validatedTicker;
    const candidates: { period: "1d" | "3d" | "7d" | "30d"; ret: number }[] = [];

    if (row.return30d !== null && row.return30d >= MIN_RETURN["30d"] && row.return30d <= MAX_RETURN) {
      candidates.push({ period: "30d", ret: row.return30d });
    }
    if (row.return7d !== null && row.return7d >= MIN_RETURN["7d"] && row.return7d <= MAX_RETURN) {
      candidates.push({ period: "7d", ret: row.return7d });
    }
    if (row.return3d !== null && row.return3d >= MIN_RETURN["3d"] && row.return3d <= MAX_RETURN) {
      candidates.push({ period: "3d", ret: row.return3d });
    }
    if (row.return1d !== null && row.return1d >= MIN_RETURN["1d"] && row.return1d <= MAX_RETURN) {
      candidates.push({ period: "1d", ret: row.return1d });
    }

    if (candidates.length === 0) continue;

    // Pick the most impressive: highest absolute return
    const best = candidates.sort((a, b) => b.ret - a.ret)[0];

    hits.push({
      symbol: t.symbol,
      recommendation: t.recommendation ?? "Watch",
      stage: t.stage,
      aiScore: t.aiScore,
      opportunityScore: t.opportunityScore,
      detectionPrice: row.detectionPrice,
      returnPct: best.ret,
      period: best.period,
      periodLabel: PERIOD_LABELS[best.period],
      catalyst: t.catalyst,
      sector: t.sector,
      marketCap: t.marketCap ? Number(t.marketCap) : null,
      detectedAt: t.createdAt,
    });
  }

  // Sort by return percentage descending, deduplicate by symbol
  const seen = new Set<string>();
  const deduped: PerformanceHit[] = [];
  for (const hit of hits.sort((a, b) => b.returnPct - a.returnPct)) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    deduped.push(hit);
  }

  return deduped.slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/*  Compose performance tweet                                          */
/* ------------------------------------------------------------------ */

const HOOKS = [
  "The data spoke first.",
  "Flagged before the crowd arrived.",
  "Signals don't lie.",
  "Early detection. Real results.",
  "The algorithm saw it coming.",
  "Caught early, confirmed later.",
  "Not luck — data.",
  "The pipeline delivered.",
];

function pickHook(symbol: string): string {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HOOKS[h % HOOKS.length];
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
}

function formatPrice(p: number): string {
  return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`;
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * Composes a single performance proof tweet for one ticker.
 */
export function composePerformanceTweet(hit: PerformanceHit, maxChars = 280): string {
  const pct = formatPct(hit.returnPct);
  const footer = `\n\nhttp://localhost:3000/ticker/${hit.symbol}`;
  // t.co shortens all URLs to 23 chars
  const footerLen = 2 + 23;

  // Line 1: The proof headline
  const line1 = `📈 $${hit.symbol} ${pct} in ${hit.periodLabel}`;

  // Hook
  const hook = pickHook(hit.symbol);

  // Line 2: Context
  const parts: string[] = [];
  parts.push(`Detected at ${formatPrice(hit.detectionPrice)}`);
  if (hit.marketCap) parts.push(formatMarketCap(hit.marketCap));
  if (hit.sector) parts.push(hit.sector);
  const line2 = parts.join(" | ");

  // Line 3: Scores at detection time
  const line3 = `Signal: ${hit.aiScore}/100 | Opportunity: ${hit.opportunityScore}/100`;

  // Hashtags
  const hashtags = "#Stocks #MarketSignals";

  // Remaining space for catalyst
  const fixedLen = line1.length + 1 + hook.length + 1 + line2.length + 1 + line3.length + 1 + hashtags.length + footerLen + 1;
  const remaining = maxChars - fixedLen;

  let body = "";
  if (hit.catalyst && remaining > 20) {
    body = truncate(hit.catalyst, remaining - 1) + "\n";
  }

  const tweet = `${line1}\n${hook}\n${line2}\n${line3}\n${body}${hashtags}${footer}`;

  // Safety trim — drop catalyst if over limit
  if (tweet.length > maxChars) {
    return `${line1}\n${hook}\n${line2}\n${line3}\n${hashtags}${footer}`;
  }

  return tweet;
}

/**
 * Composes a multi-ticker performance summary tweet (thread root).
 */
export function composePerformanceSummary(hits: PerformanceHit[], maxChars = 280): string {
  const footer = "\n\nhttp://localhost:3000/performance";

  const header = "📊 SignalScope track record — recent calls:\n";

  // One line per ticker: "$XYZ +23.1% (7d)"
  const lines: string[] = [];
  for (const hit of hits) {
    const pct = formatPct(hit.returnPct);
    lines.push(`$${hit.symbol} ${pct} (${hit.period})`);
  }

  const hashtags = "\n#Stocks #TradingTools #MarketSignals";

  // Build incrementally to stay under limit (use raw char count)
  let body = header;
  for (const line of lines) {
    const candidate = body + line + "\n";
    if (candidate.length + hashtags.length + footer.length > maxChars) break;
    body = candidate;
  }

  return (body.trimEnd() + hashtags + footer).trimEnd();
}

/* ------------------------------------------------------------------ */
/*  Post performance tweets as a thread                                */
/* ------------------------------------------------------------------ */

export interface PerformanceTweetResult {
  summary: TweetResult;
  details: { symbol: string; result: TweetResult }[];
  hits: PerformanceHit[];
}

export async function tweetPerformanceBatch(): Promise<PerformanceTweetResult> {
  const hits = await findTopPerformers(5);

  if (hits.length === 0) {
    console.log("[twitter/performance] No qualifying performers found");
    return {
      summary: { success: false, error: "No qualifying performers" },
      details: [],
      hits: [],
    };
  }

  console.log(
    `[twitter/performance] Found ${hits.length} performers: ${hits.map((h) => `${h.symbol} ${formatPct(h.returnPct)} (${h.period})`).join(", ")}`
  );

  // Post summary tweet as thread root
  const summaryText = composePerformanceSummary(hits);
  console.log(`[twitter/performance] Summary tweet (${summaryText.length} chars)`);
  const summaryResult = await postTweet(summaryText);

  const details: { symbol: string; result: TweetResult }[] = [];

  // Post individual performance tweets as thread replies
  if (summaryResult.success && summaryResult.tweetId) {
    let previousId = summaryResult.tweetId;

    for (let i = 0; i < Math.min(hits.length, 3); i++) {
      const hit = hits[i];
      const text = composePerformanceTweet(hit);
      console.log(`[twitter/performance] $${hit.symbol} detail tweet (${text.length} chars, reply to ${previousId})`);

      // Delay between posts
      await new Promise((r) => setTimeout(r, 2000));

      const result = await postTweet(text, previousId);
      details.push({ symbol: hit.symbol, result });

      if (result.success && result.tweetId) {
        previousId = result.tweetId;
      }
    }
  }

  // Mark only actually tweeted tickers so they don't repeat within the cooldown window
  if (summaryResult.success) {
    const now = new Date();
    // Only mark tickers that were actually featured in detail tweets (first 3),
    // not hits 4-5 which only appeared in the summary list.
    const tweetedSymbols = hits.slice(0, Math.min(hits.length, 3)).map((h) => h.symbol);
    await prisma.tickerPerformance.updateMany({
      where: { symbol: { in: tweetedSymbols } },
      data: { performanceTweetedAt: now },
    });
    console.log(`[twitter/performance] Marked ${tweetedSymbols.length} tickers as tweeted: ${tweetedSymbols.join(", ")}`);
  }

  return { summary: summaryResult, details, hits };
}
