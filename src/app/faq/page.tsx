import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/public-page-layout";
import { faqItems } from "@/lib/faq-data";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about SignalScope — how breakout signals work, AI scoring, LightGBM backtesting, pump-and-dump filtering, data freshness, API access, and more.",
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    url: absoluteUrl("/faq"),
    title: "FAQ — SignalScope",
    description:
      "Frequently asked questions about SignalScope — how breakout signals work, AI scoring, LightGBM backtesting, pump-and-dump filtering, data freshness, API access, and more.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalScope — Stock Breakout Signal Detection",
      },
    ],
  },
};

export default function FaqPage() {
  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "FAQ", item: absoluteUrl("/faq") },
    ],
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-2 text-zinc-400">
          Everything you need to know about SignalScope, signal detection, and API access.
        </p>
      </div>

      <div className="space-y-3">
        {faqItems.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-white/10 bg-white/4 transition-all open:shadow-sm"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white sm:text-base [&::-webkit-details-marker]:hidden">
              {item.question}
              <span className="shrink-0 text-zinc-500 transition-transform group-open:rotate-45">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
            </summary>
            <div className="px-5 pb-4">
              <p className="text-sm leading-relaxed text-zinc-300">{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </PublicPageLayout>
  );
}
