import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processSignals } from "@/lib/harvester";
import { handleApiError } from "@/lib/api-error";

const signalSchema = z.object({
  symbol: z.string(),
  source: z.enum(["REDDIT", "STOCKTWITS", "SEC_INSIDER", "SEC_FILING", "OPTIONS_FLOW", "VOLUME_SPIKE", "TWITTER"]),
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

    console.log(`[harvest/ingest] Received ${parsed.signals.length} signals (harvested at ${parsed.harvestedAt})`);

    const scanId = await processSignals(parsed.signals);

    return NextResponse.json({ status: "completed", scanId });
  } catch (err) {
    return handleApiError(err, "harvest/ingest");
  }
}
