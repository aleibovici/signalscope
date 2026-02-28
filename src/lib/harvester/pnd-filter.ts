import { chatJSON } from "@/lib/ai";
import type { AggregatedSymbol, FundamentalData, PndResult } from "./types";

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

  // 1. Price < $2.00
  if (fundamentals?.price != null && fundamentals.price < 2) {
    flags.push("penny_price");
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
  const texts = agg.signals.map((s) => `${s.title || ""} ${s.body || ""}`).join(" ").toLowerCase();
  const newsKeywords = [
    "earnings", "fda", "approval", "acquisition", "merger", "contract",
    "revenue", "partnership", "clinical", "patent", "guidance",
    "buyout", "trial results", "sec filing", "10-k", "10-q", "8-k",
  ];
  // SEC insider buys and options flow are themselves catalysts — don't flag them for lacking news
  const signalSources = new Set(agg.signals.map((s) => s.source));
  const hasNewsCatalyst =
    newsKeywords.some((kw) => texts.includes(kw)) ||
    signalSources.has("SEC_INSIDER") ||
    signalSources.has("OPTIONS_FLOW");

  if (fundamentals?.marketCap != null && fundamentals.marketCap < 50_000_000 && !hasNewsCatalyst) {
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
  if (agg.sourceCount <= 1) {
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

  // 7. No real news catalyst found (only flag if there are multiple signals but no substance)
  if (!hasNewsCatalyst && agg.signals.length > 1) {
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

  return {
    flagged: flags.length >= PND_THRESHOLD,
    flags,
    score: flags.length,
  };
}

export async function aiPndAssessment(
  symbol: string,
  agg: AggregatedSymbol,
  flags: string[]
): Promise<boolean> {
  // Only call AI for borderline cases (exactly 2 flags)
  if (flags.length !== 2) return flags.length >= PND_THRESHOLD;

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
    return typeof result?.is_pnd === "boolean" ? result.is_pnd : false;
  } catch (err) {
    console.error(`AI P&D assessment for ${symbol} error:`, err);
    return false;
  }
}
