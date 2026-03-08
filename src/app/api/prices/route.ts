import { NextRequest, NextResponse } from "next/server";
import { symbolsQuerySchema } from "@/lib/validators";
import { fetchCurrentPrice } from "@/lib/harvester/fundamentals";
import { getCurrentUserId } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { TTLCache } from "@/lib/cache";

const priceCache = new TTLCache<number | null>(5 * 60 * 1000, 500);

export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
    const symbolsParam = request.nextUrl.searchParams.get("symbols");
    if (!symbolsParam) {
      return NextResponse.json({ error: "symbols query param required" }, { status: 400 });
    }

    const symbols = symbolsQuerySchema.parse(symbolsParam);
    const prices: Record<string, number | null> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        const cached = priceCache.get(symbol);
        if (cached !== undefined) {
          prices[symbol] = cached;
          return;
        }

        const price = await fetchCurrentPrice(symbol);
        priceCache.set(symbol, price);
        prices[symbol] = price;
      })
    );

    return NextResponse.json({ prices }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    return handleApiError(err, "/api/prices GET");
  }
}
