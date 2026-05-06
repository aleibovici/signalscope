import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/components/public-page-layout";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SignalScope pricing. Free dashboard with watchlist, portfolio tracking, and weekly digest. Pro at $10/mo or $100/yr unlocks AI reports, API key access, and real-time email alerts. AI agents can pay per call via x402 micropayments — no account required.",
  alternates: { canonical: "https://signalscopes.com/pricing" },
  openGraph: {
    url: "https://signalscopes.com/pricing",
    title: "Pricing — SignalScope",
    description:
      "Free dashboard, Pro at $10/mo ($100/yr), or x402 pay-per-call for AI agents.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalScope — Pricing",
      },
    ],
  },
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Full dashboard for discretionary research.",
    features: [
      "Live dashboard, trending, and connections graph",
      "Watchlist and portfolio tracking",
      "Paper trading simulator",
      "Free weekly email digest",
    ],
    cta: { label: "Create account", href: "/register", primary: false },
    highlight: false,
  },
  {
    name: "Pro",
    price: "$10",
    cadence: "per month",
    yearly: "or $100 / year (save 17%)",
    tagline: "Unlock automation and AI-generated research.",
    features: [
      "Everything in Free",
      "On-demand AI ticker reports + trade setups",
      "Daily email alerts on Consensus signals",
      "API key access (1,000 requests/day)",
      "Priority support",
    ],
    cta: { label: "Create account → upgrade", href: "/register", primary: true },
    highlight: true,
  },
  {
    name: "Agents (x402)",
    price: "From $0.005",
    cadence: "per call",
    tagline: "Pay-per-call API via USDC on Base. No account required.",
    features: [
      "Instant access — HTTP 402 settle-on-success",
      "$0.005 per ticker lookup, $0.01 per trending/network",
      "$0.05 per AI-generated report",
      "Works with any x402-compatible client",
    ],
    cta: { label: "View API docs", href: "/skill/SKILL.md", primary: false, external: true },
    highlight: false,
  },
];

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": "https://signalscopes.com/pricing#product",
        name: "SignalScope",
        description:
          "Stock breakout signal detection — AI-scored signals from 8 sources with pump-and-dump filtering, ML backtesting, and an AI Agent Skill.",
        image: "https://signalscopes.com/opengraph-image",
        brand: { "@type": "Organization", name: "SignalScope" },
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: "https://signalscopes.com/register",
          },
          {
            "@type": "Offer",
            name: "Pro Monthly",
            price: "10",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "10",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
            },
            availability: "https://schema.org/InStock",
            url: "https://signalscopes.com/pricing",
          },
          {
            "@type": "Offer",
            name: "Pro Yearly",
            price: "100",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "100",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "ANN",
            },
            availability: "https://schema.org/InStock",
            url: "https://signalscopes.com/pricing",
          },
          {
            "@type": "Offer",
            name: "x402 Pay-Per-Call",
            price: "0.005",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            description:
              "Per-call USDC micropayments on Base (L2). No account required.",
            url: "https://signalscopes.com/skill/SKILL.md",
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://signalscopes.com" },
          { "@type": "ListItem", position: 2, name: "Pricing", item: "https://signalscopes.com/pricing" },
        ],
      },
    ],
  };

  return (
    <PublicPageLayout maxWidth="max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Simple, honest pricing
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          The dashboard is free for everyone. Upgrade when you want AI reports,
          email alerts, and API access — or skip the account entirely and pay
          per call as an AI agent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col rounded-2xl border p-6 ${
              tier.highlight
                ? "border-sky-500/40 bg-sky-950/35 shadow-[0_0_32px_-12px_rgba(56,189,248,0.25)] ring-1 ring-sky-500/20"
                : "border-white/10 bg-white/4 ring-1 ring-white/5"
            }`}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-white">{tier.name}</h2>
              {tier.highlight && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                  Most popular
                </span>
              )}
            </div>
            <div className="mb-1">
              <span className="text-3xl font-bold text-white tabular-nums">
                {tier.price}
              </span>
              <span className="ml-1 text-sm text-zinc-400">{tier.cadence}</span>
            </div>
            {tier.yearly && (
              <p className="mb-3 text-xs text-emerald-400">{tier.yearly}</p>
            )}
            <p className="mb-5 text-sm text-zinc-300">{tier.tagline}</p>
            <ul className="mb-6 flex-1 space-y-2 text-sm text-zinc-300">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {tier.cta.external ? (
              <a
                href={tier.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.cta.primary
                    ? "bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md hover:from-sky-400 hover:to-blue-500"
                    : "border border-white/20 bg-zinc-900/80 text-zinc-100 hover:border-white/30 hover:bg-zinc-800"
                }`}
              >
                {tier.cta.label}
              </a>
            ) : (
              <Link
                href={tier.cta.href}
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.cta.primary
                    ? "bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md hover:from-sky-400 hover:to-blue-500"
                    : "border border-white/20 bg-zinc-900/80 text-zinc-100 hover:border-white/30 hover:bg-zinc-800"
                }`}
              >
                {tier.cta.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-violet-500/25 bg-violet-500/10 p-6 text-center ring-1 ring-violet-500/10">
        <h2 className="text-lg font-bold text-white">
          Share SignalScope → get Pro free
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-300">
          Sign up for free and tweet about SignalScope — we&apos;ll unlock 1
          month of Pro instantly. No credit card required.
        </p>
        <Link
          href="/register"
          className="mt-4 inline-block rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:from-sky-400 hover:to-blue-500 transition-colors"
        >
          Create free account
        </Link>
      </div>
    </PublicPageLayout>
  );
}
