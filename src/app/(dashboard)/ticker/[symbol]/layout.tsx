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
      canonical: `https://signalscopes.com/ticker/${upper}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://signalscopes.com/ticker/${upper}`,
      images: [
        {
          url: `https://signalscopes.com/ticker/${upper}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${ticker.symbol} — ${rec} — SignalScope`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`https://signalscopes.com/ticker/${upper}/opengraph-image`],
    },
  };
}

export default async function TickerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ symbol: string }>;
}) {
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
      stage: true,
      createdAt: true,
    },
  });

  const jsonLd = ticker
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://signalscopes.com",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Signals",
                item: "https://signalscopes.com/dashboard",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `$${upper}`,
                item: `https://signalscopes.com/ticker/${upper}`,
              },
            ],
          },
          {
            "@type": "WebPage",
            "@id": `https://signalscopes.com/ticker/${upper}`,
            url: `https://signalscopes.com/ticker/${upper}`,
            name: `$${upper} — ${ticker.recommendation ?? "Watch"} | SignalScope`,
            description: `${ticker.name ?? upper} — ${ticker.recommendation ?? "Watch"} signal with Opportunity Score ${ticker.opportunityScore}/100`,
            dateModified: ticker.createdAt.toISOString(),
            isPartOf: { "@id": "https://signalscopes.com/#website" },
            publisher: { "@id": "https://signalscopes.com/#organization" },
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}

