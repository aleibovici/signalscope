import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

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

  // Any DB error (cold-start timeout, pool exhaustion) returns minimal metadata so
  // Next.js falls back to the file-convention opengraph-image.tsx for the OG card.
  let ticker;
  try {
    ticker = await prisma.validatedTicker.findFirst({
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
  } catch {
    return { title: `${upper} — SignalScope` };
  }

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
      canonical: absoluteUrl(`/ticker/${upper}`),
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: absoluteUrl(`/ticker/${upper}`),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const REC_COLORS: Record<string, string> = {
  "Strong Buy": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Buy":        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Watch":      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Caution":    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Avoid":      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default async function TickerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  let ticker;
  try {
    ticker = await prisma.validatedTicker.findFirst({
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
        sourceCount: true,
        marketCap: true,
        createdAt: true,
      },
    });
  } catch {
    return <>{children}</>;
  }

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
                item: siteUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Signals",
                item: absoluteUrl("/dashboard"),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `$${upper}`,
                item: absoluteUrl(`/ticker/${upper}`),
              },
            ],
          },
          {
            "@type": "WebPage",
            "@id": absoluteUrl(`/ticker/${upper}`),
            url: absoluteUrl(`/ticker/${upper}`),
            name: `$${upper} — ${ticker.recommendation ?? "Watch"} | SignalScope`,
            description: `${ticker.name ?? upper} — ${ticker.recommendation ?? "Watch"} signal with Opportunity Score ${ticker.opportunityScore}/100`,
            dateModified: ticker.createdAt.toISOString(),
            isPartOf: { "@id": `${siteUrl}/#website` },
            publisher: { "@id": `${siteUrl}/#organization` },
          },
        ],
      }
    : null;

  const rec = ticker?.recommendation ?? null;
  const stage = ticker ? (STAGE_LABELS[ticker.stage] ?? ticker.stage) : null;
  const recColorClass = rec ? (REC_COLORS[rec] ?? REC_COLORS["Watch"]) : null;
  const catalyst = ticker?.catalyst
    ? ticker.catalyst.length > 200
      ? ticker.catalyst.slice(0, 199) + "…"
      : ticker.catalyst
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {ticker && (
        <div className="mb-4 rounded-lg border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">${upper}</span>
                {ticker.name && (
                  <span className="text-sm text-gray-500 dark:text-zinc-400 truncate">{ticker.name}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                {rec && recColorClass && (
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${recColorClass}`}>
                    {rec}
                  </span>
                )}
                {stage && (
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {stage}
                  </span>
                )}
                <span className="text-gray-500 dark:text-zinc-400">
                  Opportunity <strong className="text-gray-700 dark:text-zinc-200">{ticker.opportunityScore}/100</strong>
                </span>
                <span className="text-gray-500 dark:text-zinc-400">
                  AI Score <strong className="text-gray-700 dark:text-zinc-200">{ticker.aiScore}/100</strong>
                </span>
                {ticker.sourceCount > 1 && (
                  <span className="text-gray-500 dark:text-zinc-400">
                    {ticker.sourceCount} sources
                  </span>
                )}
                {ticker.marketCap && (
                  <span className="text-gray-500 dark:text-zinc-400">
                    {formatMarketCap(ticker.marketCap)}
                  </span>
                )}
              </div>
              {catalyst && (
                <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                  {catalyst}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

