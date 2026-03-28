import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processSignals } from "@/lib/harvester";
import { handleApiError } from "@/lib/api-error";

const signalSchema = z.object({
  symbol: z.string(),
  source: z.enum(["REDDIT", "STOCKTWITS", "SEC_INSIDER", "SEC_FILING", "OPTIONS_FLOW", "VOLUME_SPIKE", "TWITTER", "CONGRESS", "POLYMARKET"]),
  title: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
  author: z.string().optional(),
  authorAge: z.number().optional(),
  authorKarma: z.number().optional(),
  upvotes: z.number().optional(),
  commentCount: z.number().optional(),
  subreddit: z.string().optional(),
  postAge: z.number().optional(),
  sortType: z.string().optional(),
  watchlistCount: z.number().optional(),
  insiderTitle: z.string().optional(),
  purchaseValue: z.number().optional(),
  optionType: z.string().optional(),
  optionVolume: z.number().optional(),
  openInterest: z.number().optional(),
  volOiRatio: z.number().optional(),
  volumeRatio: z.number().optional(),
  retweetCount: z.number().optional(),
  likeCount: z.number().optional(),
  replyCount: z.number().optional(),
  quoteCount: z.number().optional(),
  followerCount: z.number().optional(),
  isVerified: z.boolean().optional(),
  tweetType: z.string().optional(),
  marketProbability: z.number().nullable().optional().transform((v) => v ?? undefined),
  marketVolume24hr: z.number().nullable().optional().transform((v) => v ?? undefined),
  marketLiquidity: z.number().nullable().optional().transform((v) => v ?? undefined),
  marketEndDate: z.string().nullable().optional().transform((v) => v ?? undefined),
});

const ingestPayloadSchema = z.object({
  signals: z.array(signalSchema).min(1),
  harvestedAt: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    // Auth: shared secret via x-harvest-key header
    const harvestKey = req.headers.get("x-harvest-key");
    const expectedKey = process.env.HARVEST_API_KEY;

    if (!expectedKey) {
      console.error("[harvest/ingest] HARVEST_API_KEY not configured");
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
    }

    if (!harvestKey || harvestKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ingestPayloadSchema.parse(body);

    // Log source breakdown
    const sourceCounts = parsed.signals.reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const uniqueSymbols = new Set(parsed.signals.map((s) => s.symbol)).size;

    console.log(`[harvest/ingest] Received ${parsed.signals.length} signals (${uniqueSymbols} unique symbols) harvested at ${parsed.harvestedAt}`);
    console.log(`[harvest/ingest] Source breakdown:`, JSON.stringify(sourceCounts));

    const t0 = Date.now();
    const scanId = await processSignals(parsed.signals);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`[harvest/ingest] Processing completed in ${elapsed}s — scanId=${scanId}`);

    return NextResponse.json({ status: "completed", scanId });
  } catch (err) {
    return handleApiError(err, "harvest/ingest");
  }
}
