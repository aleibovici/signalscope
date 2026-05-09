import type { RawSignal } from "../types";
import { extractTickers } from "./ticker-utils";

type SortConfig = { type: "new" | "rising" | "hot"; limit: number; pages?: number };

const SUBREDDIT_CONFIG: Array<{ name: string; sorts: SortConfig[] }> = [
  { name: "wallstreetbets",       sorts: [{ type: "new", limit: 25, pages: 3 }, { type: "rising", limit: 15 }, { type: "hot", limit: 15 }] },
  { name: "stocks",               sorts: [{ type: "new", limit: 20, pages: 2 }, { type: "rising", limit: 15 }, { type: "hot", limit: 15 }] },
  { name: "investing",            sorts: [{ type: "new", limit: 15 }] },
  { name: "pennystocks",          sorts: [{ type: "new", limit: 15, pages: 2 }, { type: "rising", limit: 10 }, { type: "hot", limit: 15 }] },
  { name: "smallstreetbets",      sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "options",              sorts: [{ type: "new", limit: 15 }, { type: "rising", limit: 10 }] },
  { name: "stockmarket",          sorts: [{ type: "new", limit: 15 }] },
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
// "rising" → 3, "hot" → 2, "comment" → 1.5, new <3h → 2, new <12h → 1, else → 0.5
// Flair-based multiplier applied on top (DD=1.5, News=1.4, TA=1.2, default=1.0, YOLO=0.8, etc.)

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
    link_flair_text?: string;
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
  sort: "new" | "rising" | "hot",
  commentFetchedPermalinks: Set<string>
): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const nowSeconds = Date.now() / 1000;

  for (const post of posts) {
    const { title, selftext, author, ups, num_comments, permalink, subreddit: sub, created_utc, link_flair_text } = post.data;

    // Skip zero-engagement posts (no upvotes AND no comments) to reduce noise.
    // Rising/hot posts are exempt — Reddit already pre-filtered them for momentum.
    if (sort === "new" && ups <= 0 && num_comments === 0) continue;

    const text = `${title} ${selftext}`;
    const tickers = extractTickers(text);
    const postAgeHours = (nowSeconds - created_utc) / 3600;
    const flair = link_flair_text || undefined;

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
        flair,
      });
    }
  }

  // Comment-level ticker scanning for high-engagement posts
  const highEngagement = posts.filter((p) => p.data.num_comments >= COMMENT_ENGAGEMENT_THRESHOLD);
  let commentFetches = 0;
  for (const post of highEngagement) {
    if (commentFetches >= MAX_COMMENT_FETCHES_PER_SUB) break;
    const { title, permalink, ups, num_comments, subreddit: sub, created_utc, link_flair_text } = post.data;

    // Deduplicate comment fetches — same post may appear across new/rising/hot
    if (commentFetchedPermalinks.has(permalink)) continue;
    commentFetchedPermalinks.add(permalink);

    const postTickers = new Set(extractTickers(`${title} ${post.data.selftext}`));
    const postAgeHours = (nowSeconds - created_utc) / 3600;
    const flair = link_flair_text || undefined;

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
          flair,
        });
      }
    }
  }

  return signals;
}

interface RedditPageResponse {
  data?: {
    children: RedditPost[];
    after?: string | null;
  };
}

async function fetchRedditPage(
  subreddit: string,
  sort: string,
  limit: number,
  after?: string
): Promise<RedditPageResponse | null> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set("after", after);
  const url = `https://old.reddit.com/r/${subreddit}/${sort}.json?${params}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 429 || res.status === 503) {
    console.warn(`Reddit ${subreddit}/${sort}: ${res.status}, retrying after backoff...`);
    await sleep(5000 + Math.random() * 3000);
    const retryRes = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!retryRes.ok) {
      console.warn(`Reddit ${subreddit}/${sort}: retry failed with ${retryRes.status}`);
      return null;
    }
    return (await retryRes.json()) as RedditPageResponse;
  }

  if (!res.ok) {
    console.warn(`Reddit ${subreddit}/${sort}: ${res.status}`);
    return null;
  }

  return (await res.json()) as RedditPageResponse;
}

async function fetchSubreddit(
  subreddit: string,
  sort: "new" | "rising" | "hot",
  limit: number,
  pages: number,
  commentFetchedPermalinks: Set<string>
): Promise<RawSignal[]> {
  try {
    const allPosts: RedditPost[] = [];

    // Fetch first page
    const firstPage = await fetchRedditPage(subreddit, sort, limit);
    if (!firstPage?.data?.children) return [];
    allPosts.push(...firstPage.data.children);

    // Paginate for additional pages
    let afterToken = firstPage.data.after;
    for (let page = 2; page <= pages; page++) {
      if (!afterToken) break;
      await sleep(1500);
      const nextPage = await fetchRedditPage(subreddit, sort, limit, afterToken);
      if (!nextPage?.data?.children?.length) break;
      allPosts.push(...nextPage.data.children);
      afterToken = nextPage.data.after;
    }

    return processRedditPosts(allPosts, sort, commentFetchedPermalinks);
  } catch (err) {
    console.warn(`Reddit ${subreddit}/${sort} error:`, err);
    return [];
  }
}

export async function fetchRedditSignals(): Promise<RawSignal[]> {
  const commentFetchedPermalinks = new Set<string>();

  const tasks = SUBREDDIT_CONFIG.flatMap((config) =>
    config.sorts.map((sort) => ({
      name: config.name,
      sort: sort.type,
      limit: sort.limit,
      pages: sort.pages || 1,
    }))
  );

  // Batch 3 concurrent requests with 2s between batches to respect Reddit rate limits
  const CONCURRENCY = 3;
  const allResults: RawSignal[][] = [];

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((t) => fetchSubreddit(t.name, t.sort, t.limit, t.pages, commentFetchedPermalinks).catch((err) => {
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
