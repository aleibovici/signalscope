import { chatJSON } from "@/lib/ai";
import { postTweet, type TweetResult } from "./post";

/* ------------------------------------------------------------------ */
/*  Feature topics — rotated through for daily promotional tweets      */
/* ------------------------------------------------------------------ */

export const PROMO_TOPICS = [
  {
    id: "multi-source",
    angle: "SignalScope aggregates signals from 7 sources simultaneously — Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, volume spikes, and options flow. No single-source blind spots.",
    path: "/dashboard",
  },
  {
    id: "ai-scoring",
    angle: "Every ticker gets an AI confidence score (0–100) measuring evidence strength, plus an opportunity score ranking early-mover potential. Two scores, two different questions answered.",
    path: "/dashboard",
  },
  {
    id: "pnd-filter",
    angle: "SignalScope's pump & dump filter runs 11 statistical checks + AI edge-case detection on every ticker. Coordinated posts, micro-cap with no catalyst, sudden social spikes — all flagged before you see them.",
    path: "/methodology",
  },
  {
    id: "signal-stages",
    angle: "Signals progress through stages: EARLY (just detected), FORMING (gaining momentum), CONFIRMED (strong multi-source consensus). Get in early or wait for confirmation — your choice.",
    path: "/dashboard",
  },
  {
    id: "congress-tracking",
    angle: "Congressional stock trades are public record but hard to track. SignalScope monitors CapitolTrades.com and surfaces them alongside social signals — see what lawmakers are buying before the crowd notices.",
    path: "/dashboard",
  },
  {
    id: "sec-insider",
    angle: "SEC insider filings reveal when C-suite executives buy their own stock — one of the strongest bullish signals. SignalScope filters for purchases over $50K and cross-references with social buzz.",
    path: "/dashboard",
  },
  {
    id: "ai-reports",
    angle: "Every scored ticker can get an AI-generated research report with catalyst analysis, risk assessment, and a concrete trade setup (entry, stop-loss, targets, risk/reward ratio).",
    path: "/dashboard",
  },
  {
    id: "volume-spikes",
    angle: "A stock trading at 2x its average volume is telling you something. SignalScope scans 110+ symbols for volume spikes and combines them with social sentiment to find real breakouts vs noise.",
    path: "/dashboard",
  },
  {
    id: "options-flow",
    angle: "Unusual options activity — outsized call volume, OTM sweeps, call/put ratio spikes — often precedes big moves. SignalScope scans for these patterns alongside social signals.",
    path: "/dashboard",
  },
  {
    id: "connections",
    angle: "Tickers that appear together across scans aren't random. SignalScope maps co-occurrence networks with Jaccard similarity to reveal hidden sector rotations and correlated plays.",
    path: "/connections",
  },
  {
    id: "trending",
    angle: "SignalScope tracks tickers across every scan. When a symbol keeps appearing with rising momentum, it shows up in Trending — catch the pattern before it becomes obvious.",
    path: "/trending",
  },
  {
    id: "performance-tracking",
    angle: "Every signal gets tracked: 1-day, 3-day, 7-day, and 30-day returns computed from real price snapshots. See which signal stages and score ranges actually produce winners.",
    path: "/performance",
  },
  {
    id: "free-dashboard",
    angle: "The full SignalScope dashboard is free — signals, trending, connections, portfolio tracking. No paywall to see the data. Pro unlocks AI reports and API access.",
    path: "/dashboard",
  },
  {
    id: "agent-access",
    angle: "AI agents can access SignalScope data via the x402 protocol — pay-per-call in USDC on Base L2. No API key needed. Just send a payment and get the data.",
    path: "/methodology",
  },
  {
    id: "api-access",
    angle: "Build your own trading tools on SignalScope data. The API gives you signals, scores, trending tickers, performance history, and AI reports — all programmatically accessible.",
    path: "/profile",
  },
  {
    id: "methodology",
    angle: "Full methodology transparency: how signals are scored, how P&D detection works, what each stage means. No black box — the entire approach is documented at signalscopes.com/methodology.",
    path: "/methodology",
  },
  {
    id: "portfolio",
    angle: "Track your positions directly in SignalScope. Log entry prices, see real-time P&L, and compare your portfolio performance against the signals that led you there.",
    path: "/portfolio",
  },
  {
    id: "reddit-signals",
    angle: "Reddit moves markets — but separating DD from noise is hard. SignalScope scans multiple subreddits, extracts tickers, measures consensus, and flags coordinated pump attempts.",
    path: "/dashboard",
  },
  {
    id: "breakout-timing",
    angle: "Breakout signals have a shelf life. SignalScope tracks first-seen dates and prior appearances — so you know if you're catching a fresh signal or arriving late to the party.",
    path: "/dashboard",
  },
  {
    id: "backtested",
    angle: "SignalScope's scoring is backtested against real outcomes. ML models validate which features and thresholds actually predict price movement — not vibes, data.",
    path: "/methodology",
  },
] as const;

export type PromoTopic = (typeof PROMO_TOPICS)[number];

/* ------------------------------------------------------------------ */
/*  Deterministic topic selection — 3 unique per day                   */
/* ------------------------------------------------------------------ */

/**
 * Pick a topic for a given date and slot (0, 1, 2).
 * Uses day-of-year to rotate through topics, ensuring 3 different
 * topics each day and cycling through all topics over ~7 days.
 */
export function pickTopic(date: Date, slot: number): PromoTopic {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const index = (dayOfYear * 3 + slot) % PROMO_TOPICS.length;
  return PROMO_TOPICS[index];
}

/* ------------------------------------------------------------------ */
/*  AI tweet generation                                                */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are the social media voice of SignalScope (signalscopes.com), a stock breakout signal detection platform.

Your job: write a single tweet (max 230 chars to leave room for a URL) promoting a specific feature or capability.

Tone: dry, self-aware, lightly snarky — like someone who has seen too many pump-and-dumps and remains politely amused by how markets work. Think less "excited fintech founder", more "the friend who actually reads the SEC filings before group chat starts pumping a ticker". Humor should be understated, never loud. Wit earns trust here — use it.

Patterns that land well:
- Pointing out the absurdity of market behavior with a straight face ("Lawmakers keep saying they don't trade on inside info. SignalScope tracks their filings anyway.")
- Rhetorical contrasts ("Your conviction is 1 Reddit post. SignalScope checks 7 sources.")
- Dry understatement after a setup line ("The P&D filter noticed. Politely.")
- Short punchy sentences that reward a second read

Rules:
- End the tweet with 1-2 hashtags from the provided list (pick the most relevant to this specific topic)
- If trending cashtags are provided (e.g. $NVDA, $AAPL), naturally weave 1-3 into the tweet when they fit the topic — cashtags appear in Twitter stock search feeds and massively boost discoverability
- Use live platform stats when provided to make the tweet feel timely and data-driven (e.g. "47 breakout signals detected this morning" is better than "we detect breakout signals")
- No emojis in the first line
- One or two emojis max in the whole tweet, only if natural
- Never say "we" or "our" — use "SignalScope" or speak directly to the reader ("you")
- Vary sentence structure — don't always start with "SignalScope"
- Don't sound like an ad — sound like someone sharing something useful
- Never use phrases like "game-changer", "revolutionary", "unlock the power of", "don't miss out"
- Do NOT include any URLs in the tweet — the link is appended automatically
- The tweet text (including hashtags and cashtags) must be under 230 characters

Available hashtags (pick 1-2 that best fit the topic):
#Stocks #StockMarket #Trading #Investing #FinTech #DayTrading #SwingTrading #Options #WallStreet #AI #MarketSignals #TradingTools #StockPicks #InsiderTrading #SmartMoney

Respond with JSON: { "tweet": "..." }`;

/* ------------------------------------------------------------------ */
/*  Stats context for richer tweets                                    */
/* ------------------------------------------------------------------ */

export interface PromoStats {
  totalScans?: number;
  totalTickers?: number;
  /** Latest scan stats */
  latestSignalCount?: number;
  latestSourceCount?: number;
  latestEarlyCount?: number;
  latestFormingCount?: number;
  latestConfirmedCount?: number;
  /** Top trending cashtags (e.g. ["NVDA", "AAPL", "TSLA"]) */
  trendingSymbols?: string[];
}

function buildStatsContext(stats: PromoStats): string {
  const parts: string[] = [];

  if (stats.totalScans) parts.push(`${stats.totalScans} total scans completed`);
  if (stats.totalTickers) parts.push(`${stats.totalTickers} total tickers analyzed`);
  if (stats.latestSignalCount) parts.push(`${stats.latestSignalCount} signals detected in latest scan`);
  if (stats.latestSourceCount) parts.push(`${stats.latestSourceCount} sources active in latest scan`);
  if (stats.latestEarlyCount) parts.push(`${stats.latestEarlyCount} EARLY-stage tickers right now`);
  if (stats.latestFormingCount) parts.push(`${stats.latestFormingCount} FORMING-stage tickers right now`);
  if (stats.latestConfirmedCount) parts.push(`${stats.latestConfirmedCount} CONFIRMED-stage tickers right now`);

  if (!parts.length) return "";
  return `\n\nLive platform stats you can reference to make the tweet feel current and data-driven:\n- ${parts.join("\n- ")}`;
}

function buildCashtagContext(symbols: string[]): string {
  if (!symbols.length) return "";
  const cashtags = symbols.map((s) => `$${s}`).join(", ");
  return `\n\nTrending cashtags you may naturally weave into the tweet (use 1-3 if they fit the topic, skip if they don't): ${cashtags}`;
}

/* ------------------------------------------------------------------ */
/*  Result types                                                       */
/* ------------------------------------------------------------------ */

export interface PromoTweetResult {
  topic: string;
  tweet: string;
  url: string;
  postResult: TweetResult;
}

/* ------------------------------------------------------------------ */
/*  Generate and post                                                  */
/* ------------------------------------------------------------------ */

export async function generateAndPostPromoTweet(
  slot: number,
  stats?: PromoStats
): Promise<PromoTweetResult> {
  const now = new Date();
  const topic = pickTopic(now, slot);

  const statsContext = stats ? buildStatsContext(stats) : "";
  const cashtagContext = stats?.trendingSymbols ? buildCashtagContext(stats.trendingSymbols) : "";

  const deepLink = `https://signalscopes.com${topic.path}`;

  const userMessage = `Write a promotional tweet about this SignalScope feature:

Topic: ${topic.id}
Details: ${topic.angle}${statsContext}${cashtagContext}

Remember: max 230 chars for the tweet text (including 1-2 hashtags at the end). The URL ${deepLink} will be appended automatically — do NOT include any URL in the tweet text.`;

  const response = await chatJSON({
    callPoint: "promo",
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tier: "mini",
    temperature: 0.9,
    context: { trigger: "promo" },
  });

  const parsed = JSON.parse(response.content) as { tweet: string };
  let tweetText = parsed.tweet.trim();

  // Strip any URLs the AI may have included (we append our own)
  tweetText = tweetText.replace(/https?:\/\/\S+/g, "").trim();

  // Safety: ensure it fits with URL
  const url = `\n\n${deepLink}`;
  // t.co shortens URLs to 23 chars, so real length = tweetText + 2 (newlines) + 23
  const totalLen = tweetText.length + 2 + 23;
  if (totalLen > 280) {
    // Trim tweet text but try to preserve hashtags at the end
    const hashtagMatch = tweetText.match(/(\s+#\S+(?:\s+#\S+)?)$/);
    const hashtags = hashtagMatch ? hashtagMatch[1] : "";
    const body = hashtagMatch ? tweetText.slice(0, hashtagMatch.index) : tweetText;
    const maxBody = 280 - 25 - hashtags.length - 1; // 25 = \n\n + t.co(23), 1 for "…"
    tweetText = body.slice(0, maxBody) + "…" + hashtags;
  }

  const fullTweet = `${tweetText}${url}`;
  console.log(`[twitter/promo] Slot ${slot}, topic: ${topic.id}, tweet: ${fullTweet} (${fullTweet.length} chars)`);

  const postResult = await postTweet(fullTweet);

  return { topic: topic.id, tweet: fullTweet, url: deepLink, postResult };
}
