import type { RawSignal } from "../types";
import { extractTickers, extractCashtagTickers } from "./ticker-utils";
import { logXApiCall } from "@/lib/twitter/log";

// Single combined query — pay-per-use tier has limited search rate
// Operators like has:cashtags and lang: require Pro tier ($5000/mo)
// -is:retweet filters duplicates — engagement metrics on originals already capture amplification
const QUERY = '"short squeeze" OR "breaking out" OR "unusual volume" OR "earnings beat" OR "price target" OR "gap up" OR "FDA approval" OR "upgraded" -is:retweet';

interface TweetEntitiesCashtag {
  tag: string;
}

interface TweetPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: TweetPublicMetrics;
  entities?: {
    cashtags?: TweetEntitiesCashtag[];
  };
}

interface TwitterUser {
  id: string;
  username: string;
  created_at: string;
  verified?: boolean;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface TwitterSearchResponse {
  data?: Tweet[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchTweets(
  bearerToken: string,
  query: string,
  maxResults: number,
  startTime: string,
  nextToken?: string
): Promise<TwitterSearchResponse | null> {
  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "created_at,public_metrics,entities,author_id",
    "user.fields": "created_at,public_metrics,verified,username",
    expansions: "author_id",
    start_time: startTime,
  });
  if (nextToken) params.set("next_token", nextToken);

  const url = `https://api.x.com/2/tweets/search/recent?${params}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(15000),
    });

    logXApiCall({ endpoint: "search/recent", method: "GET", action: "harvest", statusCode: res.status });

    if (res.status === 429) {
      console.warn("Twitter: rate limited (429), returning partial results");
      return null;
    }

    if (!res.ok) {
      console.warn(`Twitter: API error ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as TwitterSearchResponse;
  } catch (err) {
    console.warn("Twitter: request error:", err);
    return null;
  }
}

export async function fetchTwitterSignals(): Promise<RawSignal[]> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn("Twitter: X_BEARER_TOKEN not set, skipping");
    return [];
  }

  // X API v2 requires max_results between 10 and 100
  const maxResults = Math.max(10, Math.min(parseInt(process.env.X_MAX_TWEETS_PER_RUN || "100", 10), 100));
  const maxPages = Math.max(1, Math.min(parseInt(process.env.X_MAX_PAGES || "3", 10), 5));

  // 4 hours ago to match harvest interval
  const startTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const nowMs = Date.now();

  const signals: RawSignal[] = [];
  const userMap = new Map<string, TwitterUser>();
  let nextToken: string | undefined;

  let pagesFetched = 0;
  for (let page = 0; page < maxPages; page++) {
    const response = await searchTweets(bearerToken, QUERY, maxResults, startTime, nextToken);
    if (!response?.data) break;
    pagesFetched++;

    // Accumulate users across pages
    for (const user of response.includes?.users || []) {
      userMap.set(user.id, user);
    }

    for (const tweet of response.data) {
      const user = userMap.get(tweet.author_id);

      // Extract tickers via regex + structured cashtag entities
      const regexTickers = extractTickers(tweet.text);
      const cashtagTickers = tweet.entities?.cashtags
        ? extractCashtagTickers(tweet.entities.cashtags.map((c) => c.tag))
        : [];
      const tickers = [...new Set([...regexTickers, ...cashtagTickers])];

      if (tickers.length === 0) continue;

      const createdAt = new Date(tweet.created_at);
      const postAgeHours = (nowMs - createdAt.getTime()) / (1000 * 3600);
      const totalEngagement =
        tweet.public_metrics.like_count +
        tweet.public_metrics.retweet_count +
        tweet.public_metrics.reply_count +
        tweet.public_metrics.quote_count;

      // "rising" if high engagement + very recent, else "new"
      const sortType = postAgeHours < 2 && totalEngagement > 50 ? "rising" : "new";

      const accountAgeDays = user
        ? (nowMs - new Date(user.created_at).getTime()) / (1000 * 86400)
        : undefined;

      for (const symbol of tickers) {
        signals.push({
          symbol,
          source: "TWITTER",
          title: tweet.text.slice(0, 280),
          body: tweet.text,
          url: user ? `https://x.com/${user.username}/status/${tweet.id}` : undefined,
          author: user?.username,
          authorAge: accountAgeDays != null ? Math.floor(accountAgeDays) : undefined,
          upvotes: tweet.public_metrics.like_count,
          commentCount: tweet.public_metrics.reply_count,
          postAge: postAgeHours,
          sortType,
          // X-specific fields
          retweetCount: tweet.public_metrics.retweet_count,
          likeCount: tweet.public_metrics.like_count,
          replyCount: tweet.public_metrics.reply_count,
          quoteCount: tweet.public_metrics.quote_count,
          followerCount: user?.public_metrics.followers_count,
          isVerified: user?.verified,
          tweetType: "keyword",
        });
      }
    }

    // Paginate if more results available
    nextToken = response.meta?.next_token;
    if (!nextToken) break;
    if (page < maxPages - 1) await sleep(1000);
  }

  console.log(`Twitter: fetched ${signals.length} raw signals (${pagesFetched} pages)`);
  return signals;
}
