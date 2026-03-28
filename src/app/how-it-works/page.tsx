import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/public-page-layout";
import {
  pipelineSteps,
  signalSources,
  sourceWeights,
  scoringBands,
  pndFlags,
  signalStages,
  recommendationLevels,
  methodologyDescription,
  aggregationDescription,
  scoringDescription,
  pndDescription,
  backtestDescription,
  backtestPipeline,
  disclaimer,
} from "@/lib/methodology-data";
import {
  scoreExplainerMethodologyTitle,
  scoreExplainerMethodologyBody,
} from "@/lib/score-explainer";

export const metadata: Metadata = {
  title: "Methodology — SignalScope",
  description: methodologyDescription,
  alternates: { canonical: "https://signalscopes.com/how-it-works" },
  openGraph: {
    url: "https://signalscopes.com/how-it-works",
    title: "Methodology — SignalScope",
    description: methodologyDescription,
  },
};

const stageLabels: Record<string, string> = {
  EARLY: "Emerging",
  FORMING: "Building",
  CONFIRMED: "Consensus",
  FILTERED: "Filtered",
};

function PipelineStrip({ steps, pillClass }: { steps: readonly string[]; pillClass: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 ${pillClass}`}>{step}</span>
          {i < steps.length - 1 && <span className="text-gray-400">→</span>}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

export default function PublicMethodologyPage() {
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://signalscopes.com" },
      { "@type": "ListItem", position: 2, name: "Methodology", item: "https://signalscopes.com/how-it-works" },
    ],
  };

  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "SignalScope Methodology — How AI-Scored Stock Breakout Signals Work",
    description: methodologyDescription,
    url: "https://signalscopes.com/how-it-works",
    image: "https://signalscopes.com/opengraph-image",
    author: { "@type": "Organization", name: "SignalScope", url: "https://signalscopes.com" },
    publisher: {
      "@type": "Organization",
      name: "SignalScope",
      url: "https://signalscopes.com",
      logo: { "@type": "ImageObject", url: "https://signalscopes.com/apple-touch-icon.png" },
    },
    mainEntityOfPage: "https://signalscopes.com/how-it-works",
  };

  return (
    <PublicPageLayout maxWidth="max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">How It Works</h1>
        <p className="mt-2 text-gray-500">{methodologyDescription}</p>
      </div>

      <div className="space-y-6">
        {/* Pipeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <PipelineStrip steps={pipelineSteps} pillClass="bg-blue-100 text-blue-800" />
        </div>

        {/* Score explainer */}
        <Section title={scoreExplainerMethodologyTitle}>
          <p className="text-sm leading-relaxed text-gray-600">{scoreExplainerMethodologyBody}</p>
        </Section>

        {/* Signal Sources */}
        <Section title="Signal Sources">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signalSources.map((src) => (
              <div key={src.name} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span>{src.icon}</span>
                  <span className="font-medium text-gray-900">{src.name}</span>
                </div>
                <p className="text-sm text-gray-600">{src.description}</p>
                <p className="mt-1 text-xs text-gray-400">{src.params}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Aggregation */}
        <Section title="Signal Aggregation & Source Weights">
          <p className="mb-4 text-sm leading-relaxed text-gray-600">{aggregationDescription}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sourceWeights.map((row) => (
                  <tr key={row.source}>
                    <td className="py-1.5 pr-4 text-gray-700">{row.source}</td>
                    <td className="py-1.5 font-mono text-gray-900">{row.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* AI Scoring */}
        <Section title="AI Scoring (0-100)">
          <p className="mb-4 text-sm leading-relaxed text-gray-600">{scoringDescription}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="pb-2 pr-4">Band</th>
                  <th className="pb-2">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scoringBands.map((row) => (
                  <tr key={row.band}>
                    <td className="py-1.5 pr-4 font-mono text-gray-900">{row.band}</td>
                    <td className="py-1.5 text-gray-600">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* P&D */}
        <Section title="Pump & Dump Detection">
          <p className="mb-4 text-sm leading-relaxed text-gray-600">{pndDescription}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pndFlags.map((item) => (
              <div key={item.flag} className="flex items-start gap-2">
                <span className="mt-0.5 whitespace-nowrap rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs font-medium text-red-700">
                  {item.flag}
                </span>
                <span className="text-sm text-gray-600">{item.desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Signal Stages */}
        <Section title="Signal Stages">
          <div className="grid gap-3 sm:grid-cols-2">
            {signalStages.map((item) => (
              <div key={item.stage} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${item.color.replace(/dark:[^\s]+/g, "").trim()}`}>
                  {stageLabels[item.stage] ?? item.stage}
                </span>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Recommendation Levels */}
        <Section title="Recommendation Levels">
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendationLevels.map((item) => (
              <div key={item.level} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${item.color.replace(/dark:[^\s]+/g, "").trim()}`}>
                  {item.level}
                </span>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ML Backtesting */}
        <Section title="ML Backtesting & Continuous Improvement">
          <p className="mb-4 text-sm leading-relaxed text-gray-600">{backtestDescription}</p>
          <PipelineStrip steps={backtestPipeline} pillClass="bg-indigo-100 text-indigo-800" />
        </Section>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-400">{disclaimer}</p>
      </div>
    </PublicPageLayout>
  );
}
