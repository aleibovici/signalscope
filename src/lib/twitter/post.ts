import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  OAuth 1.0a helpers (Node built-in crypto, no extra deps)          */
/* ------------------------------------------------------------------ */

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildOAuthHeader(method: string, url: string, body: Record<string, string>, creds: TwitterCredentials): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // Merge all params for signature base string
  const allParams = { ...oauthParams, ...body };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  oauthParams["oauth_signature"] = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

/* ------------------------------------------------------------------ */
/*  Twitter credentials                                                */
/* ------------------------------------------------------------------ */

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function getCredentials(): TwitterCredentials | null {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

/* ------------------------------------------------------------------ */
/*  Post a tweet via X API v2                                          */
/* ------------------------------------------------------------------ */

const TWEET_URL = "https://api.x.com/2/tweets";

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Find a thread to reply into for a cashtag (by engagement)         */
/* ------------------------------------------------------------------ */

/** Target for POST /2/tweets reply — use thread root so the post shows in the full conversation. */
export interface CashtagReplyTarget {
  /** Pass to `reply.in_reply_to_tweet_id` (conversation root when API provides it). */
  inReplyToTweetId: string;
  /** The search hit we ranked (may differ from inReplyToTweetId when replying at thread root). */
  matchedTweetId: string;
}

type SearchTweet = {
  id: string;
  author_id?: string;
  conversation_id?: string;
  public_metrics?: { retweet_count: number; like_count: number };
  reply_settings?: "everyone" | "mentionedUsers" | "following";
};

function engagementScore(m: SearchTweet["public_metrics"]): number {
  if (!m) return 0;
  return m.retweet_count + m.like_count;
}

/**
 * Picks a high-engagement $SYMBOL hit and returns the **conversation root** tweet id so replies
 * appear in the same thread in the X UI (not orphaned under a deep reply).
 */
export async function findCashtagReplyTarget(symbol: string): Promise<CashtagReplyTarget | null> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return null;

  const query = `$${symbol} -is:retweet`;
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    query,
    max_results: "10",
    expansions: "author_id",
    "tweet.fields": "public_metrics,conversation_id,author_id,reply_settings",
    "user.fields": "username",
    start_time: startTime,
  });

  try {
    const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[twitter/post] findCashtagReplyTarget $${symbol}: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      data?: SearchTweet[];
      includes?: { users?: { id: string; username: string }[] };
    };
    if (!data.data || data.data.length === 0) return null;

    // Only consider tweets where anyone can reply
    const replyable = data.data.filter((t) => !t.reply_settings || t.reply_settings === "everyone");
    if (replyable.length === 0) {
      console.log(`[twitter/post] findCashtagReplyTarget $${symbol}: ${data.data.length} hits but none allow replies`);
      return null;
    }

    const top = [...replyable].sort((a, b) => engagementScore(b.public_metrics) - engagementScore(a.public_metrics))[0];

    const threadRoot = top.conversation_id ?? top.id;
    const m = top.public_metrics ?? { retweet_count: 0, like_count: 0 };
    const author =
      top.author_id && data.includes?.users?.find((u) => u.id === top.author_id)?.username;

    console.log(
      `[twitter/post] Reply target for $${symbol}: thread_root=${threadRoot} matched=${top.id}` +
        ` (RT:${m.retweet_count} ❤:${m.like_count})${author ? ` @${author}` : ""}` +
        ` reply_settings=${top.reply_settings ?? "everyone"}`
    );

    return { inReplyToTweetId: threadRoot, matchedTweetId: top.id };
  } catch (err) {
    console.warn(`[twitter/post] findCashtagReplyTarget $${symbol} error:`, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Post a tweet via X API v2                                          */
/* ------------------------------------------------------------------ */

export async function postTweet(text: string, replyToTweetId?: string): Promise<TweetResult> {
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: "Twitter credentials not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)" };
  }

  if (text.length > 280) {
    return { success: false, error: `Tweet exceeds 280 chars (${text.length})` };
  }

  try {
    const bodyObj: Record<string, unknown> = { text };
    // auto_populate_reply_metadata: X prepends @mentions so the reply is wired to the conversation
    // (and stays under limits when composeTickerTweet reserves headroom for replies).
    if (replyToTweetId) {
      bodyObj.reply = {
        in_reply_to_tweet_id: replyToTweetId,
        auto_populate_reply_metadata: true,
      };
    }
    const body = JSON.stringify(bodyObj);
    // OAuth body signing only applies to form-encoded bodies; JSON body uses empty params
    const authHeader = buildOAuthHeader("POST", TWEET_URL, {}, creds);

    const res = await fetch(TWEET_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[twitter/post] ${res.status}: ${errBody}`);
      return { success: false, error: `X API ${res.status}: ${errBody}` };
    }

    const data = (await res.json()) as { data?: { id?: string } };
    const tweetId = data.data?.id;
    console.log(`[twitter/post] ✓ Tweet posted${tweetId ? ` (id: ${tweetId})` : ""}`);
    return { success: true, tweetId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[twitter/post] Error: ${msg}`);
    return { success: false, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/*  Per-ticker tweet composition & posting                             */
/* ------------------------------------------------------------------ */

export interface TickerDetail {
  symbol: string;
  recommendation: string;
  catalyst: string;
  risks: string;
  aiReasoning: string | null;
  stage: string;
  opportunityScore: number;
  aiScore: number;
  price: number | null;
  marketCap: number | null;
  sector: string | null;
  sourceCount: number;
}

const recEmoji: Record<string, string> = {
  "Strong Buy": "🟢",
  Buy: "🟢",
  Watch: "🟡",
  Avoid: "🔴",
};

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

function formatPrice(p: number): string {
  return p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * @param maxChars — default 280; use lower (e.g. 235) for replies when X may prepend @mentions via
 *   `auto_populate_reply_metadata`, so the final post stays within 280.
 */
export function composeTickerTweet(t: TickerDetail, maxChars: number = 280): string {
  const emoji = recEmoji[t.recommendation] ?? "⚪";
  const footer = `\n\nhttps://signalscopes.com/ticker/${t.symbol}`;
  // t.co shortens all URLs to 23 chars
  const footerLen = 2 + 23;

  // Line 1: Symbol + recommendation + stage
  let line1 = `${emoji} $${t.symbol} — ${t.recommendation}`;
  if (t.stage === "EARLY") line1 += " (New Signal)";
  else if (t.stage === "FORMING") line1 += " (Building)";

  // Line 2: Price + market cap + sector + sources
  const parts: string[] = [];
  if (t.price) parts.push(formatPrice(t.price));
  if (t.marketCap) parts.push(formatMarketCap(t.marketCap));
  if (t.sector) parts.push(t.sector);
  parts.push(`${t.sourceCount} sources`);
  const line2 = parts.join(" | ");

  // Line 3: Scores
  const line3 = `Signal: ${t.aiScore}/100 | Opportunity: ${t.opportunityScore}/100`;

  // Remaining space: catalyst + AI reasoning
  const fixedLen = line1.length + 1 + line2.length + 1 + line3.length + 1 + footerLen + 1;
  const remaining = maxChars - fixedLen;

  // Build analysis body: catalyst first, then AI reasoning if space allows
  let body: string;
  if (t.aiReasoning && t.catalyst.length + 1 + t.aiReasoning.length <= remaining) {
    // Both fit
    body = t.catalyst + "\n" + t.aiReasoning;
  } else if (t.aiReasoning && t.catalyst.length < remaining - 30) {
    // Catalyst fits, truncate reasoning
    const reasoningSpace = remaining - t.catalyst.length - 1;
    body = t.catalyst + "\n" + truncate(t.aiReasoning, reasoningSpace);
  } else {
    // Just catalyst, truncated
    body = truncate(t.catalyst, remaining);
  }

  const tweet = `${line1}\n${line2}\n${line3}\n${body}${footer}`;

  // Safety trim
  if (tweet.length > maxChars) {
    const over = tweet.length - maxChars;
    return `${line1}\n${line2}\n${line3}\n${truncate(t.catalyst, remaining - over)}${footer}`;
  }

  return tweet;
}

/* ------------------------------------------------------------------ */
/*  Market-cap-diversified selection (2 per tier)                      */
/* ------------------------------------------------------------------ */

type CapTier = "micro" | "small" | "mid" | "large" | "mega";

function getCapTier(marketCap: number | null): CapTier {
  if (!marketCap) return "micro"; // unknown treated as micro
  if (marketCap < 300_000_000) return "micro";       // < $300M
  if (marketCap < 2_000_000_000) return "small";     // $300M–$2B
  if (marketCap < 10_000_000_000) return "mid";      // $2B–$10B
  if (marketCap < 200_000_000_000) return "large";   // $10B–$200B
  return "mega";                                      // $200B+
}

const TIERS_ORDERED: CapTier[] = ["micro", "small", "mid", "large", "mega"];
const PER_TIER = 2;

export function selectDiversifiedTickers(candidates: TickerDetail[], maxTotal = 10): TickerDetail[] {
  // Bucket by market cap tier (already sorted by opportunityScore from DB)
  const buckets = new Map<CapTier, TickerDetail[]>();
  for (const tier of TIERS_ORDERED) buckets.set(tier, []);

  for (const t of candidates) {
    const tier = getCapTier(t.marketCap);
    buckets.get(tier)!.push(t);
  }

  // Pick top 2 from each tier
  const selected: TickerDetail[] = [];
  for (const tier of TIERS_ORDERED) {
    const bucket = buckets.get(tier)!;
    selected.push(...bucket.slice(0, PER_TIER));
  }

  // If we have fewer than maxTotal, backfill from tiers that had extras
  if (selected.length < maxTotal) {
    const selectedSymbols = new Set(selected.map((t) => t.symbol));
    for (const tier of TIERS_ORDERED) {
      const bucket = buckets.get(tier)!;
      for (const t of bucket) {
        if (selected.length >= maxTotal) break;
        if (!selectedSymbols.has(t.symbol)) {
          selected.push(t);
          selectedSymbols.add(t.symbol);
        }
      }
      if (selected.length >= maxTotal) break;
    }
  }

  // Sort final selection by opportunityScore desc
  return selected.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export interface TweetBatchResult {
  /** Root tweets on our timeline (only when no thread target or reply failed and we fell back). */
  posted: { symbol: string; tweetId?: string }[];
  failed: { symbol: string; error: string }[];
  /** inReplyToTweetId is the thread root passed to the API (conversation root when available). */
  replies: { symbol: string; tweetId?: string; inReplyToTweetId: string; matchedTweetId: string }[];
  replyFailed: { symbol: string; error: string }[];
}

/** Headroom for X prepending @mentions on replies (`auto_populate_reply_metadata`). */
const REPLY_COMPOSE_MAX_CHARS = 235;

export async function tweetTickerBatch(tickers: TickerDetail[]): Promise<TweetBatchResult> {
  const posted: { symbol: string; tweetId?: string }[] = [];
  const failed: { symbol: string; error: string }[] = [];
  const replies: { symbol: string; tweetId?: string; inReplyToTweetId: string; matchedTweetId: string }[] = [];
  const replyFailed: { symbol: string; error: string }[] = [];

  for (const ticker of tickers) {
    // Resolve trending thread first so we only consume one tweet when replying (no duplicate standalone + reply)
    await new Promise((r) => setTimeout(r, 1000));
    const target = await findCashtagReplyTarget(ticker.symbol);

    const text = composeTickerTweet(ticker, target ? REPLY_COMPOSE_MAX_CHARS : 280);
    console.log(`[twitter/post] $${ticker.symbol}: composed tweet (${text.length} chars${target ? ", reply budget" : ""})`);

    if (target) {
      console.log(
        `[twitter/post] Replying in thread ${target.inReplyToTweetId} (matched ${target.matchedTweetId}) for $${ticker.symbol}`
      );
      const replyResult = await postTweet(text, target.inReplyToTweetId);
      if (replyResult.success) {
        replies.push({
          symbol: ticker.symbol,
          tweetId: replyResult.tweetId,
          inReplyToTweetId: target.inReplyToTweetId,
          matchedTweetId: target.matchedTweetId,
        });
      } else {
        const replyErr = replyResult.error ?? "Unknown error";
        console.warn(`[twitter/post] Reply failed for $${ticker.symbol}, posting to timeline instead: ${replyErr}`);
        const fallbackText = composeTickerTweet(ticker, 280);
        const fallback = await postTweet(fallbackText);
        if (fallback.success) {
          posted.push({ symbol: ticker.symbol, tweetId: fallback.tweetId });
        } else {
          replyFailed.push({
            symbol: ticker.symbol,
            error: `Reply: ${replyErr}; fallback: ${fallback.error ?? "Unknown error"}`,
          });
        }
      }
    } else {
      console.log(`[twitter/post] No top tweet for $${ticker.symbol}, posting to timeline only`);
      const result = await postTweet(text);
      if (result.success) {
        posted.push({ symbol: ticker.symbol, tweetId: result.tweetId });
      } else {
        failed.push({ symbol: ticker.symbol, error: result.error ?? "Unknown error" });
      }
    }

    // Delay between tickers to avoid rate limiting
    if (tickers.indexOf(ticker) < tickers.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { posted, failed, replies, replyFailed };
}
