import { NextRequest, NextResponse } from "next/server";
import { symbolsQuerySchema } from "@/lib/validators";
import { fetchCurrentPrice } from "@/lib/harvester/fundamentals";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

// Simple in-memory cache (5 min TTL, max 500 entries)
const priceCache = new Map<string, { price: number | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 500;

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const symbolsParam = request.nextUrl.searchParams.get("symbols");
    if (!symbolsParam) {
      return NextResponse.json({ error: "symbols query param required" }, { status: 400 });
    }

    const symbols = symbolsQuerySchema.parse(symbolsParam);
    const now = Date.now();
    const prices: Record<string, number | null> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        const cached = priceCache.get(symbol);
        if (cached && now - cached.ts < CACHE_TTL) {
          prices[symbol] = cached.price;
          return;
        }

        const price = await fetchCurrentPrice(symbol);
        if (priceCache.size >= CACHE_MAX) {
          // Evict oldest entry
          const oldest = priceCache.keys().next().value;
          if (oldest !== undefined) priceCache.delete(oldest);
        }
        priceCache.set(symbol, { price, ts: now });
        prices[symbol] = price;
      })
    );

    return NextResponse.json({ prices });
  } catch (err) {
    return handleApiError(err, "/api/prices GET");
  }
}
