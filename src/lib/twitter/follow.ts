import { prisma } from "@/lib/prisma";
import {
  buildOAuthHeader,
  getCredentials,
  type TwitterCredentials,
} from "./post";
import { logXApiCall } from "./log";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const FOLLOW_BATCH = 5; // X rate limit: 5 follows per 15-min window
const UNFOLLOW_BATCH = 3;
const DISCOVER_LOOKUP_CAP = 10; // max usernames to resolve per run (API credit budget)
const STALE_DAYS = 30;
const DISCOVER_LOOKBACK_HOURS = 72;

/* ------------------------------------------------------------------ */
/*  Seed accounts — curated finance / market handles                   */
/*  Add or remove as needed. `keep: true` = never auto-unfollowed.     */
/* ------------------------------------------------------------------ */

const SEED_ACCOUNTS: { username: string; keep: boolean }[] = [
  // Market news & unusual activity
  { username: "unusual_whales", keep: true },
  { username: "DeItaone", keep: true },
  { username: "FirstSquawk", keep: true },
  { username: "Newsquawk", keep: true },
  // Congress & insider tracking
  { username: "QuiverQuant", keep: true },
  // Trading / fintech community
  { username: "TradeAlgoBot", keep: false },
  // Options flow
  { username: "OptionsHawk", keep: true },
  // Market data & research
  { username: "Barchart", keep: true },
  { username: "StockMKTNewz", keep: false },
];

/* ------------------------------------------------------------------ */
/*  X API helpers                                                      */
/* ------------------------------------------------------------------ */

let cachedMyUserId: string | null = null;

/** Throttle follower-list fetches to at most once every 12 hours. */
const FOLLOWER_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * GET /2/users/me — returns our authenticated user's numeric ID.
 * Persists to XApiLog so the resolved ID survives process restarts.
 */
async function getMyUserId(
  creds: TwitterCredentials
): Promise<string | null> {
  if (cachedMyUserId) return cachedMyUserId;

  // Check DB for a recently resolved ID (avoids API call on cold start)
  const cached = await prisma.xApiLog.findFirst({
    where: { endpoint: "users/me", action: "lookup", statusCode: 200 },
    orderBy: { createdAt: "desc" },
    select: { responseBody: true },
  });
  if (cached?.responseBody) {
    cachedMyUserId = cached.responseBody;
    console.log(`[twitter/follow] Authenticated user ID (from DB cache): ${cachedMyUserId}`);
    return cachedMyUserId;
  }

  const url = "https://api.x.com/2/users/me";
  const auth = buildOAuthHeader("GET", url, {}, creds);

  try {
    const res = await fetch(url, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logXApiCall({ endpoint: "users/me", method: "GET", action: "lookup", statusCode: res.status });
      console.error(`[twitter/follow] GET /users/me ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { data?: { id: string } };
    cachedMyUserId = data.data?.id ?? null;
    logXApiCall({ endpoint: "users/me", method: "GET", action: "lookup", statusCode: res.status, responseBody: cachedMyUserId ?? undefined });
    if (cachedMyUserId) {
      console.log(`[twitter/follow] Authenticated user ID: ${cachedMyUserId}`);
    }
    return cachedMyUserId;
  } catch (err) {
    console.error("[twitter/follow] getMyUserId error:", err);
    return null;
  }
}

/**
 * GET /2/users/by?usernames=... — batch resolve handles → IDs.
 * Uses Bearer token (app-level, avoids OAuth query-param signing).
 * Returns map of lowercase(username) → { id, username }.
 */
async function lookupUserIds(
  usernames: string[]
): Promise<Map<string, { id: string; username: string }>> {
  const result = new Map<string, { id: string; username: string }>();
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer || usernames.length === 0) return result;

  // Twitter usernames: 1-15 alphanumeric/underscore chars
  const validUsername = /^[A-Za-z0-9_]{1,15}$/;
  const filtered = usernames.filter((u) => {
    if (!validUsername.test(u)) {
      console.warn(`[twitter/follow] Skipping invalid username: @${u}`);
      return false;
    }
    return true;
  });
  if (filtered.length === 0) return result;

  // API allows up to 100 per request
  for (let i = 0; i < filtered.length; i += 100) {
    const batch = filtered.slice(i, i + 100);
    const url = `https://api.x.com/2/users/by?usernames=${batch.join(",")}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(15_000),
      });
      logXApiCall({ endpoint: "users/by", method: "GET", action: "lookup", count: batch.length, statusCode: res.status });
      if (!res.ok) {
        console.warn(`[twitter/follow] lookupUserIds ${res.status}: ${await res.text()}`);
        continue;
      }
      const data = (await res.json()) as {
        data?: { id: string; username: string }[];
      };
      for (const u of data.data ?? []) {
        result.set(u.username.toLowerCase(), { id: u.id, username: u.username });
      }
    } catch (err) {
      console.warn("[twitter/follow] lookupUserIds error:", err);
    }

    // Small delay between batches
    if (i + 100 < filtered.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return result;
}

/** POST /2/users/:myId/following — follow a user. */
async function apiFollow(
  myId: string,
  targetId: string,
  creds: TwitterCredentials
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.x.com/2/users/${myId}/following`;
  const auth = buildOAuthHeader("POST", url, {}, creds);
  const body = JSON.stringify({ target_user_id: targetId });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    logXApiCall({ endpoint: "following", method: "POST", action: "follow", statusCode: res.status });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status}: ${text}` };
    }
    const data = (await res.json()) as { data?: { following: boolean } };
    return { ok: data.data?.following === true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** DELETE /2/users/:myId/following/:targetId — unfollow a user. */
async function apiUnfollow(
  myId: string,
  targetId: string,
  creds: TwitterCredentials
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.x.com/2/users/${myId}/following/${targetId}`;
  const auth = buildOAuthHeader("DELETE", url, {}, creds);

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    logXApiCall({ endpoint: "following", method: "DELETE", action: "unfollow", statusCode: res.status });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * GET /2/users/:myId/followers — fetch our followers (paginated).
 * Returns set of follower user IDs. Uses Bearer token.
 */
async function fetchMyFollowerIds(myId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) return ids;

  let nextToken: string | undefined;
  let pages = 0;
  const maxPages = 5; // up to 5000 followers

  do {
    const params = new URLSearchParams({ max_results: "1000" });
    if (nextToken) params.set("pagination_token", nextToken);

    const url = `https://api.x.com/2/users/${myId}/followers?${params}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(15_000),
      });
      logXApiCall({ endpoint: "followers", method: "GET", action: "followers", statusCode: res.status });
      if (!res.ok) {
        console.warn(`[twitter/follow] fetchFollowers ${res.status}`);
        break;
      }
      const data = (await res.json()) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      for (const u of data.data ?? []) ids.add(u.id);
      nextToken = data.meta?.next_token;
      pages++;
    } catch (err) {
      console.warn("[twitter/follow] fetchFollowers error:", err);
      break;
    }
  } while (nextToken && pages < maxPages);

  console.log(`[twitter/follow] Fetched ${ids.size} follower IDs (${pages} pages)`);
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Business logic                                                     */
/* ------------------------------------------------------------------ */

/** Ensure seed accounts exist in the queue (idempotent). */
async function ensureSeedAccounts(): Promise<number> {
  // Find which seeds are already in DB (any source — includes unresolvable)
  const existing = await prisma.twitterFollow.findMany({
    where: {
      username: { in: SEED_ACCOUNTS.map((s) => s.username.toLowerCase()) },
    },
    select: { username: true },
  });
  const existingSet = new Set(existing.map((r) => r.username.toLowerCase()));

  const missing = SEED_ACCOUNTS.filter(
    (s) => !existingSet.has(s.username.toLowerCase())
  );
  if (missing.length === 0) return 0;

  // Batch lookup IDs for missing seeds
  const idMap = await lookupUserIds(missing.map((s) => s.username));

  let added = 0;
  for (const seed of missing) {
    const handle = seed.username.toLowerCase();
    const resolved = idMap.get(handle);
    if (!resolved) {
      // Mark unresolvable so we never re-lookup this username
      console.warn(`[twitter/follow] Seed @${seed.username} not found on X, marking unresolvable`);
      try {
        await prisma.twitterFollow.create({
          data: {
            twitterId: `unresolvable_${handle}`,
            username: handle,
            source: "unresolvable",
            reason: "Seed account — username could not be resolved via X API",
            priority: 0,
          },
        });
      } catch {
        // unique constraint — already marked
      }
      continue;
    }
    try {
      await prisma.twitterFollow.upsert({
        where: { username: resolved.username.toLowerCase() },
        create: {
          twitterId: resolved.id,
          username: resolved.username.toLowerCase(),
          source: "seed",
          reason: "Seed account — finance/market community",
          priority: 10,
          keep: seed.keep,
        },
        update: {}, // already exists, no-op
      });
      added++;
    } catch {
      // unique constraint race — safe to ignore
    }
  }

  console.log(`[twitter/follow] Added ${added} seed accounts to queue`);
  return added;
}

/**
 * Discover follow targets from recent Twitter harvest signals.
 * Only runs when a new scan has completed since the last discovery —
 * avoids redundant Bearer-token lookups across the 3 daily runs.
 */
async function discoverFromHarvest(): Promise<number> {
  // Gate on new scan: skip if no scan has completed since our last discovery run
  const lastDiscoverySignal = await prisma.twitterFollow.findFirst({
    where: { source: "harvest" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const latestScan = await prisma.scan.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (lastDiscoverySignal && latestScan && latestScan.startedAt <= lastDiscoverySignal.createdAt) {
    console.log("[twitter/follow] No new scan since last discovery, skipping");
    return 0;
  }

  const since = new Date(Date.now() - DISCOVER_LOOKBACK_HOURS * 60 * 60 * 1000);

  // Get unique Twitter signal authors from recent scans
  const signals = await prisma.signal.findMany({
    where: {
      source: "TWITTER",
      author: { not: null },
      createdAt: { gte: since },
    },
    select: { author: true, followerCount: true },
    distinct: ["author"],
  });

  if (signals.length === 0) return 0;

  // Filter out authors we already track (including "unresolvable" placeholders)
  const existingUsernames = new Set(
    (
      await prisma.twitterFollow.findMany({
        select: { username: true },
      })
    ).map((r) => r.username)
  );

  const newAuthors = signals.filter(
    (s) => s.author && !existingUsernames.has(s.author.toLowerCase())
  );
  if (newAuthors.length === 0) return 0;

  // Cap lookups to conserve X API credits — queue is already deep
  const capped = newAuthors.slice(0, DISCOVER_LOOKUP_CAP);
  if (capped.length < newAuthors.length) {
    console.log(`[twitter/follow] Capping discovery lookup to ${DISCOVER_LOOKUP_CAP} of ${newAuthors.length} new authors`);
  }

  // Batch lookup IDs
  const usernames = capped.map((s) => s.author!);
  const idMap = await lookupUserIds(usernames);

  let added = 0;
  for (const signal of capped) {
    const handle = signal.author!.toLowerCase();
    const resolved = idMap.get(handle);

    if (!resolved) {
      // Mark unresolvable so we don't re-lookup on subsequent runs
      try {
        await prisma.twitterFollow.create({
          data: {
            twitterId: `unresolvable_${handle}`,
            username: handle,
            source: "unresolvable",
            reason: "Username could not be resolved via X API",
            priority: 0,
          },
        });
      } catch {
        // unique constraint — already marked
      }
      continue;
    }

    // Higher priority for accounts with more followers
    const followers = signal.followerCount ?? 0;
    const priority = followers > 50_000 ? 8 : followers > 10_000 ? 5 : followers > 1_000 ? 3 : 1;

    try {
      await prisma.twitterFollow.create({
        data: {
          twitterId: resolved.id,
          username: resolved.username.toLowerCase(),
          source: "harvest",
          reason: `Active in stock discussions (${followers.toLocaleString()} followers)`,
          priority,
          keep: false,
        },
      });
      added++;
    } catch {
      // unique constraint — already exists
    }
  }

  console.log(`[twitter/follow] Discovered ${added} new accounts from harvest (${capped.length}/${newAuthors.length} candidates, cap=${DISCOVER_LOOKUP_CAP})`);
  return added;
}

/** Follow the next batch from the queue. */
async function processFollows(
  limit: number,
  creds: TwitterCredentials,
  myId: string
): Promise<{ followed: string[]; errors: string[] }> {
  const followed: string[] = [];
  const errors: string[] = [];

  // Get unfollowed accounts, highest priority first, oldest first within same priority
  const queue = await prisma.twitterFollow.findMany({
    where: { followedAt: null, unfollowedAt: null, source: { not: "unresolvable" } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });

  if (queue.length === 0) {
    console.log("[twitter/follow] Follow queue empty");
    return { followed, errors };
  }

  for (const target of queue) {
    const result = await apiFollow(myId, target.twitterId, creds);
    if (result.ok) {
      await prisma.twitterFollow.update({
        where: { id: target.id },
        data: { followedAt: new Date() },
      });
      followed.push(target.username);
      console.log(`[twitter/follow] Followed @${target.username}`);
    } else {
      errors.push(`@${target.username}: ${result.error}`);
      console.warn(`[twitter/follow] Failed to follow @${target.username}: ${result.error}`);
    }

    // Small delay between API calls
    if (followed.length + errors.length < queue.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return { followed, errors };
}

/** Unfollow stale accounts that haven't followed back. */
async function processUnfollows(
  limit: number,
  creds: TwitterCredentials,
  myId: string
): Promise<{ unfollowed: string[]; errors: string[] }> {
  const unfollowed: string[] = [];
  const errors: string[] = [];

  const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const stale = await prisma.twitterFollow.findMany({
    where: {
      followedAt: { not: null, lte: staleDate },
      unfollowedAt: null,
      followBack: false,
      keep: false,
    },
    orderBy: { followedAt: "asc" },
    take: limit,
  });

  if (stale.length === 0) {
    console.log("[twitter/follow] No stale follows to unfollow");
    return { unfollowed, errors };
  }

  for (const target of stale) {
    const result = await apiUnfollow(myId, target.twitterId, creds);
    if (result.ok) {
      await prisma.twitterFollow.update({
        where: { id: target.id },
        data: { unfollowedAt: new Date() },
      });
      unfollowed.push(target.username);
      console.log(`[twitter/follow] Unfollowed @${target.username} (followed ${STALE_DAYS}+ days, no follow-back)`);
    } else {
      errors.push(`@${target.username}: ${result.error}`);
      console.warn(`[twitter/follow] Failed to unfollow @${target.username}: ${result.error}`);
    }

    if (unfollowed.length + errors.length < stale.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return { unfollowed, errors };
}

/** Check which of our followed accounts have followed us back. */
async function updateFollowBacks(myId: string): Promise<number> {
  // Persist throttle in DB via XApiLog — survives process restarts
  const lastCheck = await prisma.xApiLog.findFirst({
    where: { action: "followers" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastCheck && Date.now() - lastCheck.createdAt.getTime() < FOLLOWER_CHECK_INTERVAL_MS) {
    const minAgo = Math.round((Date.now() - lastCheck.createdAt.getTime()) / 60_000);
    console.log(`[twitter/follow] Skipping follower check (last ran ${minAgo} min ago, interval: 12h)`);
    return 0;
  }

  const followerIds = await fetchMyFollowerIds(myId);
  if (followerIds.size === 0) return 0;

  // Get all actively followed accounts (not yet unfollowed)
  const active = await prisma.twitterFollow.findMany({
    where: { followedAt: { not: null }, unfollowedAt: null },
    select: { id: true, twitterId: true, followBack: true, username: true },
  });

  let updated = 0;
  for (const record of active) {
    const isFollower = followerIds.has(record.twitterId);
    if (isFollower !== record.followBack) {
      await prisma.twitterFollow.update({
        where: { id: record.id },
        data: { followBack: isFollower },
      });
      updated++;
      if (isFollower) {
        console.log(`[twitter/follow] @${record.username} followed back!`);
      }
    }
  }

  console.log(`[twitter/follow] Follow-back check: ${updated} updates (${followerIds.size} total followers)`);
  return updated;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

export interface FollowJobResult {
  discovered: number;
  seeded: number;
  followed: string[];
  followErrors: string[];
  unfollowed: string[];
  unfollowErrors: string[];
  followBacksUpdated: number;
  queueSize: number;
}

export async function runFollowJob(): Promise<FollowJobResult> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error("Twitter credentials not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)");
  }

  const myId = await getMyUserId(creds);
  if (!myId) {
    throw new Error("Could not resolve authenticated Twitter user ID");
  }

  // 1. Seed accounts (idempotent — skips existing)
  const seeded = await ensureSeedAccounts();

  // 2. Discover new targets from harvest
  const discovered = await discoverFromHarvest();

  // 3. Follow next batch
  const { followed, errors: followErrors } = await processFollows(
    FOLLOW_BATCH,
    creds,
    myId
  );

  // 4. Unfollow stale accounts
  const { unfollowed, errors: unfollowErrors } = await processUnfollows(
    UNFOLLOW_BATCH,
    creds,
    myId
  );

  // 5. Update follow-backs
  const followBacksUpdated = await updateFollowBacks(myId);

  // 6. Current queue size (exclude unresolvable placeholders)
  const queueSize = await prisma.twitterFollow.count({
    where: { followedAt: null, unfollowedAt: null, source: { not: "unresolvable" } },
  });

  const result: FollowJobResult = {
    discovered,
    seeded,
    followed,
    followErrors,
    unfollowed,
    unfollowErrors,
    followBacksUpdated,
    queueSize,
  };

  console.log(
    `[twitter/follow] Job complete: +${discovered} discovered, ${followed.length} followed, ${unfollowed.length} unfollowed, ${queueSize} queued`
  );

  return result;
}
