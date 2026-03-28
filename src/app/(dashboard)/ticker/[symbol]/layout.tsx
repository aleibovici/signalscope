import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

const STAGE_LABELS: Record<string, string> = {
  EARLY: "Emerging",
  FORMING: "Building",
  CONFIRMED: "Consensus",
  FILTERED: "Filtered",
};

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  const ticker = await prisma.validatedTicker.findFirst({
    where: { symbol: upper },
    orderBy: { createdAt: "desc" },
    select: {
      symbol: true,
      name: true,
      recommendation: true,
      opportunityScore: true,
      aiScore: true,
      catalyst: true,
      stage: true,
      marketCap: true,
      sourceCount: true,
    },
  });

  if (!ticker) {
    return { title: `${upper} — SignalScope` };
  }

  const rec = ticker.recommendation ?? "Watch";
  const stage = STAGE_LABELS[ticker.stage] ?? ticker.stage;
  const title = `$${ticker.symbol} — ${rec} | SignalScope`;

  const parts: string[] = [];
  if (ticker.name) parts.push(ticker.name);
  parts.push(`${rec} (${stage})`);
  parts.push(`Opportunity: ${ticker.opportunityScore}/100`);
  parts.push(`AI: ${ticker.aiScore}/100`);
  if (ticker.marketCap) parts.push(formatMarketCap(ticker.marketCap));
  parts.push(`${ticker.sourceCount} sources`);
  if (ticker.catalyst) {
    const cat = ticker.catalyst.length > 120 ? ticker.catalyst.slice(0, 119) + "\u2026" : ticker.catalyst;
    parts.push(cat);
  }
  const description = parts.join(" \u2014 ");

  return {
    title,
    description,
    alternates: {
      canonical: `http://localhost:3000/ticker/${upper}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `http://localhost:3000/ticker/${upper}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function TickerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
