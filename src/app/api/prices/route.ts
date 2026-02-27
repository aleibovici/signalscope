import { NextRequest, NextResponse } from "next/server";
import { symbolsQuerySchema } from "@/lib/validators";
import { fetchCurrentPrice } from "@/lib/harvester/fundamentals";

// Simple in-memory cache (5 min TTL)
const priceCache = new Map<string, { price: number | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
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
      priceCache.set(symbol, { price, ts: now });
      prices[symbol] = price;
    })
  );

  return NextResponse.json({ prices });
}
