import { chatJSON } from "@/lib/ai";
import type { AggregatedSymbol, FundamentalData, PndAiResult, PndResult } from "./types";

// Subreddits that, when a ticker appears ONLY here, are a red flag
const PENNY_ONLY_SUBREDDITS = new Set([
  "pennystocks",
  "smallstreetbets",
]);

// Reputable subreddits — presence here means the ticker has broader attention
const REPUTABLE_SUBREDDITS = new Set([
  "stocks",
  "investing",
  "wallstreetbets",
]);

const PND_THRESHOLD = 3;

// Flags that predict positive returns per ML backtesting — detected for data purposes
// but excluded from the PnD threshold count
const INFORMATIONAL_FLAGS = new Set([
  "penny_price",        // +3.8% avg 7d return — bullish, not bearish
  "otc_listing",        // +1.3% avg 7d return — bullish, not bearish
  "twitter_coordinated_pump", // +1.5% avg 7d return — bullish, not bearish
  "coordinated_posts",  // -0.4% avg 7d — negligible impact, fires too broadly (n=1275)
  "single_source",      // -0.4% avg 7d — negligible impact, fires too broadly (n=2632)
]);

const HYPE_PHRASES = [
  "guaranteed", "can't lose", "cant lose", "load up now", "load up",
  "this will 10x", "10x", "100x", "1000x", "1000%",
  "send it", "moon", "rocket", "to the moon",
  "next gme", "next gamestop", "buy now", "get in before",
  "this will explode", "life changing", "easy money",
  "once in a lifetime", "free money", "trust me",
  "not financial advice but buy", "yolo into this",
];

export function checkPndFlags(
  agg: AggregatedSymbol,
  fundamentals: FundamentalData | null
): PndResult {
  const flags: string[] = [];

  // Pre-compute catalyst presence (used by multiple flags)
  const texts = agg.signals.map((s) => `${s.title || ""} ${s.body || ""}`).join(" ").toLowerCase();
  const newsKeywords = [
    "earnings", "fda", "approval", "acquisition", "merger", "contract",
    "revenue", "partnership", "clinical", "patent", "guidance",
    "buyout", "trial results", "sec filing", "10-k", "10-q", "8-k",
    "buyback", "dividend", "spinoff", "spin-off", "restructuring",
    "analyst", "price target", "beat estimates", "guidance raised",
    "upgraded", "downgrade", "stock split", "offering", "ipo",
    "catalyst", "breakthrough", "settlement", "regulatory",
  ];
  const signalSources = new Set(agg.signals.map((s) => s.source));
  const hasNewsCatalyst =
    newsKeywords.some((kw) => texts.includes(kw)) ||
    signalSources.has("SEC_INSIDER") ||
    signalSources.has("OPTIONS_FLOW") ||
    signalSources.has("CONGRESS");

  // 1. Price < $1.00 (skip if a verifiable catalyst exists — legitimate biotech/pharma trade under $1 with FDA catalysts)
  if (fundamentals?.price != null && fundamentals.price < 0.50 && !hasNewsCatalyst) {
    flags.push("penny_price");
  }

  // 1b. 52-week floor is sub-dime — stock has historically traded at near-zero levels (shell/zombie risk)
  if (fundamentals?.wk52Lo != null && fundamentals.wk52Lo < 0.09 && !hasNewsCatalyst) {
    flags.push("sub_dime_52wk_floor");
  }

  // 1c. Disproportionately high upvotes relative to post count — coordinated vote boosting without organic discussion
  const redditPostCount = agg.signals.filter((s) => s.source === "REDDIT").length;
  if (
    !hasNewsCatalyst &&
    agg.totalUpvotes > 2000 &&
    redditPostCount <= 3 &&
    agg.totalComments < 30
  ) {
    flags.push("upvote_pump");
  }

  // 2. Listed on OTC/Pink Sheets (not NYSE/NASDAQ/AMEX)
  if (fundamentals?.exchange) {
    const ex = fundamentals.exchange.toUpperCase();
    const isReputableExchange =
      ex.includes("NYSE") || ex.includes("NASDAQ") || ex.includes("AMEX") || ex.includes("ARCA");
    if (!isReputableExchange) {
      flags.push("otc_listing");
    }
  }

  // 3. Market cap < $50M with no real news catalyst
  if (
    fundamentals?.marketCap != null &&
    fundamentals.marketCap < 40_000_000 &&
    !hasNewsCatalyst &&
    agg.totalUpvotes < 500 &&
    agg.subredditCount < 3
  ) {
    flags.push("micro_cap_no_catalyst");
  }

  // 4. Mentioned ONLY in r/pennystocks or r/smallstreetbets (not in reputable subs)
  const subreddits = agg.signals
    .filter((s) => s.source === "REDDIT" && s.subreddit)
    .map((s) => s.subreddit!.toLowerCase());
  const inReputable = subreddits.some((sub) => REPUTABLE_SUBREDDITS.has(sub));
  const inPennyOnly = subreddits.length > 0 && subreddits.every((sub) => PENNY_ONLY_SUBREDDITS.has(sub));
  if (inPennyOnly && !inReputable) {
    flags.push("only_penny_subs");
  }

  // 5. Single source only (only Reddit, zero corroboration from options/insider/StockTwits)
  if (agg.sourceCount <= 1 && agg.signals.length <= 2 && agg.totalUpvotes < 20) {
    flags.push("single_source");
  }

  // 6. Coordinated or hyperbolic language + identical phrasing detection
  const hypeCount = HYPE_PHRASES.filter((phrase) => texts.includes(phrase)).length;
  if (hypeCount >= 3) {
    flags.push("hyperbolic_language");
  }

  // Check for identical/near-identical phrasing across multiple posts
  const titles = agg.signals
    .filter((s) => s.title)
    .map((s) => s.title!.toLowerCase().trim());
  if (titles.length >= 2) {
    const titleSet = new Set(titles);
    const duplicateRatio = 1 - titleSet.size / titles.length;
    if (duplicateRatio >= 0.5) {
      flags.push("coordinated_posts");
    }
  }

  // 7. No real news catalyst found (only flag if there are 5+ signals but no substance)
  if (!hasNewsCatalyst && agg.signals.length >= 5) {
    flags.push("no_news_catalyst");
  }

  // 8. Sudden spike with no preceding action — signals all very recent with high velocity
  //    but no organic buildup (all posts < 3 hours, high velocity, low upvotes)
  const redditSignals = agg.signals.filter((s) => s.source === "REDDIT");
  if (redditSignals.length >= 3) {
    const allVeryRecent = redditSignals.every((s) => s.postAge != null && s.postAge < 3);
    const avgUpvotes =
      redditSignals.reduce((sum, s) => sum + (s.upvotes || 0), 0) / redditSignals.length;
    if (allVeryRecent && avgUpvotes < 10) {
      flags.push("sudden_spike");
    }
  }

  // 9. Twitter bot promoters: ≥2 Twitter signals, ≥50% from accounts <90 days old AND <50 followers
  const twitterSignals = agg.signals.filter((s) => s.source === "TWITTER");
  if (twitterSignals.length >= 2) {
    const botLike = twitterSignals.filter(
      (s) =>
        s.authorAge !== undefined && s.authorAge < 90 &&
        s.followerCount !== undefined && s.followerCount < 50
    );
    if (botLike.length >= twitterSignals.length * 0.5) {
      flags.push("twitter_bot_promoters");
    }
  }

  // 11. Twitter coordinated pump: ≥3 Twitter signals, ≥40% with near-identical text (first 100 chars)
  if (twitterSignals.length >= 3) {
    const prefixes = twitterSignals
      .filter((s) => s.body)
      .map((s) => s.body!.slice(0, 100).toLowerCase().trim());
    if (prefixes.length >= 3) {
      const prefixCounts = new Map<string, number>();
      for (const p of prefixes) {
        prefixCounts.set(p, (prefixCounts.get(p) || 0) + 1);
      }
      const maxDupes = Math.max(...prefixCounts.values());
      if (maxDupes >= prefixes.length * 0.4) {
        flags.push("twitter_coordinated_pump");
      }
    }
  }

  const effectiveFlags = flags.filter((f) => !INFORMATIONAL_FLAGS.has(f));

  return {
    flagged: effectiveFlags.length >= PND_THRESHOLD,
    flags,
    score: flags.length,
  };
}

export async function aiPndAssessment(
  symbol: string,
  agg: AggregatedSymbol,
  flags: string[]
): Promise<PndAiResult> {
  // Only call AI for borderline cases (exactly at threshold - 1 effective flags)
  const effectiveFlags = flags.filter((f) => !INFORMATIONAL_FLAGS.has(f));
  if (effectiveFlags.length !== PND_THRESHOLD - 1) return { flagged: effectiveFlags.length >= PND_THRESHOLD };

  try {
    const response = await chatJSON({
      callPoint: "pnd",
      tier: "standard",
      temperature: 0.2,
      systemPrompt: `You are a pump-and-dump detection expert. Analyze signals for ${symbol} and determine if this appears to be a coordinated pump scheme.

Current flags: ${flags.join(", ")}

Return JSON: { "is_pnd": true/false, "confidence": 0-100, "reasoning": "brief explanation" }`,
      userMessage: JSON.stringify({
        symbol,
        signalCount: agg.signals.length,
        sourceCount: agg.sourceCount,
        avgVelocity: agg.avgVelocity,
        samplePosts: agg.signals.slice(0, 5).map((s) => ({
          title: s.title,
          source: s.source,
          subreddit: s.subreddit,
          upvotes: s.upvotes,
          author: s.author,
          postAge: s.postAge,
        })),
      }),
    });

    const result = JSON.parse(response.content);
    const isPnd = result?.is_pnd;
    const confidence = typeof result?.confidence === "number" ? result.confidence : undefined;
    const reasoning = typeof result?.reasoning === "string" ? result.reasoning : undefined;

    let flagged: boolean;
    if (typeof isPnd === "boolean") flagged = isPnd;
    else if (isPnd === "true") flagged = true;
    else if (isPnd === "false") flagged = false;
    else {
      console.warn(`[pnd] ${symbol}: unexpected is_pnd value "${isPnd}", defaulting to flagged`);
      flagged = true;
    }

    return { flagged, confidence, reasoning };
  } catch (err) {
    console.error(`AI P&D assessment for ${symbol} error — flagging borderline ticker as cautionary:`, err);
    return { flagged: true };
  }
}
