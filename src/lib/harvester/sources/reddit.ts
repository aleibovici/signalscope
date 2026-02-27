import type { RawSignal } from "../types";

const SUBREDDIT_CONFIG: Array<{ name: string; sorts: Array<{ type: "new" | "rising"; limit: number }> }> = [
  { name: "wallstreetbets",  sorts: [{ type: "new", limit: 25 }, { type: "rising", limit: 15 }] },
  { name: "stocks",          sorts: [{ type: "new", limit: 20 }, { type: "rising", limit: 15 }] },
  { name: "investing",       sorts: [{ type: "new", limit: 15 }] },
  { name: "pennystocks",     sorts: [{ type: "new", limit: 15 }] },
  { name: "smallstreetbets", sorts: [{ type: "new", limit: 15 }] },
  { name: "options",         sorts: [{ type: "new", limit: 15 }] },
  { name: "stockmarket",     sorts: [{ type: "new", limit: 15 }] },
  { name: "Undervalued",     sorts: [{ type: "new", limit: 10 }] },
  { name: "ValueInvesting",  sorts: [{ type: "new", limit: 10 }] },
  { name: "spacs",           sorts: [{ type: "new", limit: 10 }] },
  { name: "weedstocks",      sorts: [{ type: "new", limit: 10 }] },
];

const TICKER_REGEX = /\b([A-Z]{1,5})\b/g;

// Common English words that look like tickers
const BLACKLIST = new Set([
  // Single/two-letter words
  "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "IF", "IN",
  "IS", "IT", "ME", "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO", "UP",
  "US", "WE", "DD", "TA", "PE", "SP",
  // Financial acronyms & market terms
  "CEO", "IPO", "ETF", "SEC", "FBI", "FDA", "IMO", "YOLO", "FOMO",
  "EPS", "GDP", "CPI", "ATH", "ATL", "OTC", "NYSE", "NASDAQ",
  "USD", "EUR", "GBP", "JPY",
  "NFA", "DCA", "ROI", "DCF", "VWAP", "PCE", "YTD", "ITM", "OTM", "ATM",
  "QQQ", "SPX", "SPY", "DJI", "VIX", "APY", "CFO", "CTO", "COO", "CMO",
  "CFD", "NAV", "AUM", "RFP", "EOD", "REIT", "SPAC",
  // Reddit/internet slang
  "WSB", "HODL", "TLDR", "LMAO", "ROFL", "IMHO", "AFAIK", "NSFW", "TIL",
  "PSA", "IIRC", "FYI", "AMA",
  // Non-US markets/exchanges
  "TSX", "TSXV", "LSE", "ASX", "FTSE", "DAX", "NIKKEI",
  // Common 3-letter words
  "ALL", "ARE", "BUT", "CAN", "FOR", "GET", "HAS", "HAD", "HER", "HIM",
  "HIS", "HOW", "ITS", "LET", "MAY", "NEW", "NOT", "NOW", "OLD", "OUR",
  "OUT", "OWN", "SAY", "SHE", "THE", "TOO", "TWO", "WAY", "WHO", "BOY",
  "DID", "DON", "GOT", "HIT", "HOT", "LOT", "MAN", "PUT", "RAN", "RED",
  "RUN", "SET", "SIT", "TOP", "TRY", "USE", "WAS", "WIN", "WON", "YET",
  "YOU", "BIG", "ANY", "DAY", "END", "FAR", "FEW", "GAS",
  // Common 4-letter words (original)
  "HIGH", "LOW", "LONG", "JUST", "VERY", "MUCH", "THAT", "THIS", "WHAT",
  "WHEN", "WILL", "WITH", "HAVE", "FROM", "BEEN", "SOME", "THAN", "THEM",
  "THEN", "THEY", "CALL", "HOLD", "SELL", "PUMP", "DUMP", "MOON", "BEAR",
  "BULL", "GAIN", "LOSS", "EDIT", "HOPE", "BEST", "POST", "EVER", "STOP",
  "GOOD", "TAKE", "MAKE", "LIKE", "NEXT", "OVER", "BACK", "CASH", "RISK",
  "FREE", "HELP", "HERE", "LOOK", "ONLY", "REAL", "SURE", "WELL", "DOWN",
  "SAME", "OPEN", "TELL", "TRUE", "TURN", "KEEP", "EVEN", "LAST", "MOVE",
  "PAYS", "SAFE", "SAVE", "WORK",
  // Common 3-5 letter words (expanded)
  "WOW", "GOAT", "BEAT", "HYPE", "AUTO", "ALSO", "AWAY", "COME", "EACH",
  "ELSE", "FEEL", "FIND", "FIVE", "FOUR", "FULL", "GAVE", "GONE", "GROW",
  "HALF", "HAND", "HARD", "HEAD", "IDEA", "INTO", "KNEW", "KNOW", "LEFT",
  "LIFE", "LINE", "LIST", "LIVE", "MANY", "MOST", "MUST", "NAME", "NEED",
  "ONCE", "PART", "PAST", "PLAN", "PLAY", "PULL", "PURE", "PUSH", "READ",
  "REST", "RISE", "RULE", "SEEN", "SHOW", "SIDE", "SIGN", "SIZE", "TALK",
  "TEAM", "TECH", "TEND", "THUS", "TIME", "TONE", "TOLD", "TOOK", "TYPE",
  "UPON", "USED", "VAST", "VIEW", "VOTE", "WAIT", "WALK", "WANT", "WIDE",
  "WORD", "YEAR", "ZERO",
]);

const MEGA_CAPS = new Set([
  "AAPL", "MSFT", "GOOG", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
  "SPY", "QQQ", "BRK", "JPM", "V", "MA", "UNH", "JNJ", "WMT", "PG",
]);

function extractTickers(text: string): string[] {
  const matches = text.match(TICKER_REGEX) || [];
  return [...new Set(matches.filter((t) => !BLACKLIST.has(t) && !MEGA_CAPS.has(t) && t.length >= 2))];
}

function computeVelocityScore(sortType: "new" | "rising", postAgeHours: number): number {
  if (sortType === "rising") return 3;
  if (postAgeHours < 3) return 2;
  if (postAgeHours < 12) return 1;
  return 0.5;
}

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

async function fetchSubreddit(
  subreddit: string,
  sort: "new" | "rising",
  limit: number
): Promise<RawSignal[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SignalScope/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`Reddit ${subreddit}/${sort}: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const posts: RedditPost[] = json?.data?.children || [];
    const signals: RawSignal[] = [];
    const nowSeconds = Date.now() / 1000;

    for (const post of posts) {
      const { title, selftext, author, ups, num_comments, permalink, subreddit: sub, created_utc } = post.data;
      const text = `${title} ${selftext}`;
      const tickers = extractTickers(text);
      const postAgeHours = (nowSeconds - created_utc) / 3600;
      const velocityScore = computeVelocityScore(sort, postAgeHours);

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

    return signals;
  } catch (err) {
    console.warn(`Reddit ${subreddit}/${sort} error:`, err);
    return [];
  }
}

export async function fetchRedditSignals(): Promise<RawSignal[]> {
  const promises = SUBREDDIT_CONFIG.flatMap((config) =>
    config.sorts.map((sort) => fetchSubreddit(config.name, sort.type, sort.limit))
  );

  const results = await Promise.allSettled(promises);
  const signals: RawSignal[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      signals.push(...result.value);
    }
  }

  console.log(`Reddit: fetched ${signals.length} raw signals`);
  return signals;
}
