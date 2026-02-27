/**
 * Quick connectivity test for X/Twitter API v2.
 * Usage: npx tsx scripts/test-twitter.ts
 */

import "dotenv/config";

const BEARER = process.env.X_BEARER_TOKEN;

if (!BEARER) {
  console.error("X_BEARER_TOKEN not set in .env");
  process.exit(1);
}

async function testQuery(label: string, query: string) {
  const params = new URLSearchParams({
    query,
    max_results: "10",
    "tweet.fields": "created_at,public_metrics,entities,author_id",
    "user.fields": "created_at,public_metrics,verified,username",
    expansions: "author_id",
  });

  const url = `https://api.x.com/2/tweets/search/recent?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER}` },
  });

  const body = await res.json();

  // Show rate limit info
  const remaining = res.headers.get("x-rate-limit-remaining");
  const resetEpoch = res.headers.get("x-rate-limit-reset");
  if (remaining != null) {
    const resetIn = resetEpoch ? Math.max(0, Number(resetEpoch) - Math.floor(Date.now() / 1000)) : "?";
    console.log(`       Rate limit: ${remaining} remaining, resets in ${resetIn}s`);
  }

  if (!res.ok) {
    console.error(`[FAIL] ${label}: ${res.status} ${res.statusText}`);
    if (res.status === 429 && resetEpoch) {
      const waitSec = Math.max(0, Number(resetEpoch) - Math.floor(Date.now() / 1000));
      console.error(`       Rate limited. Try again in ${waitSec} seconds.`);
    } else {
      console.error("  ", JSON.stringify(body.errors?.[0] || body, null, 2));
    }
    return false;
  }

  const count = body.meta?.result_count ?? 0;
  const sample = body.data?.[0];
  console.log(`[OK]   ${label}: ${count} tweets returned`);
  if (sample) {
    const cashtags = sample.entities?.cashtags?.map((c: { tag: string }) => `$${c.tag}`) || [];
    console.log(`       Sample: "${sample.text.slice(0, 100)}..."`);
    if (cashtags.length) console.log(`       Cashtags: ${cashtags.join(", ")}`);
  }
  return true;
}

async function main() {
  console.log("Testing X API v2 connectivity (api.x.com)...\n");

  const result = await testQuery(
    "Stock keywords",
    '"short squeeze" OR "breaking out" OR "unusual volume" OR "earnings beat" OR "price target" OR "gap up" OR "FDA approval" OR "upgraded"'
  );

  console.log(`\n${result ? "1/1" : "0/1"} queries passed`);
  process.exit(result ? 0 : 1);
}

main();
