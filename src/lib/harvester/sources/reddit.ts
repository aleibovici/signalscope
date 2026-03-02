import type { RawSignal } from "../types";
import { extractTickers } from "./ticker-utils";

const SUBREDDIT_CONFIG: Array<{ name: string; sorts: Array<{ type: "new" | "rising"; limit: number }> }> = [
  { name: "wallstreetbets",       sorts: [{ type: "new", limit: 25 }, { type: "rising", limit: 15 }] },
  { name: "stocks",               sorts: [{ type: "new", limit: 20 }, { type: "rising", limit: 15 }] },
  { name: "investing",            sorts: [{ type: "new", limit: 15 }] },
  { name: "pennystocks",          sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "smallstreetbets",      sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "options",              sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "stockmarket",          sorts: [{ type: "new", limit: 15 }] },
  { name: "Undervalued",          sorts: [{ type: "new", limit: 10 }] },
  { name: "ValueInvesting",       sorts: [{ type: "new", limit: 10 }] },
  { name: "spacs",                sorts: [{ type: "new", limit: 10 }] },
  { name: "weedstocks",           sorts: [{ type: "new", limit: 10 }] },
  // Breakout/momentum-focused subreddits
  { name: "Shortsqueeze",         sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "RobinHoodPennyStocks", sorts: [{ type: "new", limit: 15 }] },
  { name: "Daytrading",           sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "SwingTrading",         sorts: [{ type: "new", limit: 10 }] },
  { name: "biotech",              sorts: [{ type: "new", limit: 10 }] },
  { name: "SecurityAnalysis",     sorts: [{ type: "new", limit: 10 }] },
  { name: "MillennialBets",       sorts: [{ type: "new", limit: 10 }] },
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Velocity scoring tiers (computed in index.ts aggregateSignals):
// "rising" → 3, "comment" → 1.5, new <3h → 2, new <12h → 1, else → 0.5

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    author: string;
    ups: number;
    num_comments: number;
    permalink: string;
    subreddit: string;
    created_utc: number;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_COMMENT_FETCHES_PER_SUB = 3;
const COMMENT_ENGAGEMENT_THRESHOLD = 25;

interface RedditComment {
  author: string;
  body: string;
}

async function fetchTopComments(permalink: string, limit: number = 10): Promise<RedditComment[]> {
  const url = `https://old.reddit.com${permalink}.json?limit=${limit}&depth=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const comments = data[1]?.data?.children || [];
    return comments
      .filter((c: { kind: string }) => c.kind === "t1")
      .map((c: { data?: { body?: string; author?: string } }) => ({
        author: c.data?.author || "unknown",
        body: c.data?.body || ""
      }))
      .filter((comment: RedditComment) => comment.body.length > 0);
  } catch {
    return [];
  }
}

async function processRedditPosts(
  posts: RedditPost[],
  sort: "new" | "rising"
): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const nowSeconds = Date.now() / 1000;

  for (const post of posts) {
    const { title, selftext, author, ups, num_comments, permalink, subreddit: sub, created_utc } = post.data;
    const text = `${title} ${selftext}`;
    const tickers = extractTickers(text);
    const postAgeHours = (nowSeconds - created_utc) / 3600;

    for (const symbol of tickers) {
      signals.push({
        symbol,
        source: "REDDIT",
        title,
        body: selftext.slice(0, 2000),
        url: `https://reddit.com${permalink}`,
        author,
        upvotes: ups,
        commentCount: num_comments,
        subreddit: sub,
        postAge: postAgeHours,
        sortType: sort,
      });
    }
  }

  // Comment-level ticker scanning for high-engagement posts
  const highEngagement = posts.filter((p) => p.data.num_comments >= COMMENT_ENGAGEMENT_THRESHOLD);
  let commentFetches = 0;
  for (const post of highEngagement) {
    if (commentFetches >= MAX_COMMENT_FETCHES_PER_SUB) break;
    const { title, permalink, ups, num_comments, subreddit: sub, created_utc } = post.data;
    const postTickers = new Set(extractTickers(`${title} ${post.data.selftext}`));
    const postAgeHours = (nowSeconds - created_utc) / 3600;

    await sleep(2000);
    const comments = await fetchTopComments(permalink);
    commentFetches++;

    for (const comment of comments) {
      const commentTickers = extractTickers(comment.body).filter((t) => !postTickers.has(t));

      for (const symbol of commentTickers) {
        signals.push({
          symbol,
          source: "REDDIT",
          title: `[comment] ${title}`,
          body: comment.body.slice(0, 2000),
          url: `https://reddit.com${permalink}`,
          author: comment.author,
          upvotes: ups,
          commentCount: num_comments,
          subreddit: sub,
          postAge: postAgeHours,
          sortType: "comment",
        });
      }
    }
  }

  return signals;
}

async function fetchSubreddit(
  subreddit: string,
  sort: "new" | "rising",
  limit: number
): Promise<RawSignal[]> {
  const url = `https://old.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 429 || res.status === 503) {
      // Retry once with backoff for rate-limiting / temporary outages
      console.warn(`Reddit ${subreddit}/${sort}: ${res.status}, retrying after backoff...`);
      await sleep(5000 + Math.random() * 3000);
      const retryRes = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!retryRes.ok) {
        console.warn(`Reddit ${subreddit}/${sort}: retry failed with ${retryRes.status}`);
        return [];
      }
      const retryJson = await retryRes.json();
      const retryPosts: RedditPost[] = retryJson?.data?.children || [];
      return processRedditPosts(retryPosts, sort);
    }

    if (!res.ok) {
      console.warn(`Reddit ${subreddit}/${sort}: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const posts: RedditPost[] = json?.data?.children || [];
    return processRedditPosts(posts, sort);
  } catch (err) {
    console.warn(`Reddit ${subreddit}/${sort} error:`, err);
    return [];
  }
}

export async function fetchRedditSignals(): Promise<RawSignal[]> {
  const tasks = SUBREDDIT_CONFIG.flatMap((config) =>
    config.sorts.map((sort) => ({ name: config.name, sort: sort.type as "new" | "rising", limit: sort.limit }))
  );

  // Batch 3 concurrent requests with 2s between batches to respect Reddit rate limits
  const CONCURRENCY = 3;
  const allResults: RawSignal[][] = [];

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((t) => fetchSubreddit(t.name, t.sort, t.limit).catch((err) => {
        console.warn(`Reddit ${t.name}/${t.sort} error:`, err);
        return [] as RawSignal[];
      }))
    );
    allResults.push(...results);
    if (i + CONCURRENCY < tasks.length) await sleep(2000);
  }

  const signals = allResults.flat();
  console.log(`Reddit: fetched ${signals.length} raw signals`);
  return signals;
}
