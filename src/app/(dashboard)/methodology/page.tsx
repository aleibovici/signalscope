import type { Metadata } from "next";
import { stageLabel } from "@/lib/stage-labels";

export const metadata: Metadata = {
  title: "Methodology",
  alternates: { canonical: "http://localhost:3000/how-it-works" },
  robots: { index: false, follow: false },
};
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

// Arc gauge — semicircle (same geometry as signal card)
const ARC_LENGTH = Math.PI * 32;

function ArcGauge({ value, type }: { value: number; type: "opportunity" | "confidence" }) {
  const fill = (Math.min(Math.max(value, 0), 100) / 100) * ARC_LENGTH;
  const isOpp = type === "opportunity";
  const fillColor = isOpp ? "#f59e0b" : "#3b82f6";
  const labelClass = isOpp ? "text-amber-500 dark:text-amber-400" : "text-blue-500 dark:text-blue-400";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[9px] font-bold uppercase tracking-widest ${labelClass}`}>
        {isOpp ? "Opportunity" : "AI Confidence"}
      </span>
      <svg width="72" height="36" viewBox="0 1 80 38" aria-hidden="true">
        <path d="M 8 36 A 32 32 0 0 1 72 36" fill="none" stroke="currentColor"
          className="text-gray-200 dark:text-zinc-700" strokeWidth={5} strokeLinecap="round" />
        <path d="M 8 36 A 32 32 0 0 1 72 36" fill="none" stroke={fillColor}
          strokeWidth={5} strokeLinecap="round" strokeDasharray={`${fill} ${ARC_LENGTH}`} />
      </svg>
      <span className="-mt-1 text-sm font-bold tabular-nums leading-none text-gray-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

const SCORE_BANDS = [
  { label: "Noise",       range: "0–19",  color: "bg-red-500/80" },
  { label: "Social-only", range: "20–39", color: "bg-amber-500/80" },
  { label: "Unconfirmed", range: "40–59", color: "bg-zinc-500/70" },
  { label: "Strong",      range: "60–79", color: "bg-blue-500/80" },
  { label: "Very Strong", range: "80–100",color: "bg-[#4edea3]/80" },
];

const effectiveFlags = pndFlags.filter((_, i) => i < 8);
const infoFlags = pndFlags.filter((_, i) => i >= 8);

export default function MethodologyPage() {
  return (
    <div className="space-y-8 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 md:text-2xl">How It Works</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500 dark:text-zinc-400">{methodologyDescription}</p>
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-2">
          {pipelineSteps.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-blue-400/50 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/30 dark:text-blue-300">
                {step}
              </span>
              {i < pipelineSteps.length - 1 && (
                <span className="text-gray-400 dark:text-zinc-600">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Score explainer */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{scoreExplainerMethodologyTitle}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="relative flex items-start gap-5 px-5 py-5 sm:border-r border-gray-200 dark:border-zinc-800">
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] dark:block"
              style={{ background: "linear-gradient(to bottom, #f59e0b, #f97316)" }} aria-hidden="true" />
            <ArcGauge value={72} type="opportunity" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">Opportunity</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
                Early-mover rank. Validated in ML and used to sort the Signal Dashboard. Higher = earlier or more favorable setup.
              </p>
            </div>
          </div>
          <div className="relative flex items-start gap-5 border-t border-gray-200 px-5 py-5 dark:border-zinc-800 sm:border-t-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] dark:block"
              style={{ background: "linear-gradient(to bottom, #3b82f6, #6366f1)" }} aria-hidden="true" />
            <ArcGauge value={90} type="confidence" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">AI Confidence</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
                Evidence strength. High confidence can mean the crowd already agrees — high confidence ≠ more remaining upside.
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 dark:border-zinc-800/60 dark:bg-zinc-900/20">
          <p className="text-xs leading-relaxed text-gray-500 dark:text-zinc-500">{scoreExplainerMethodologyBody}</p>
        </div>
      </div>

      {/* Signal Sources */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Signal Sources</h2>
          <span className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-400">
            {signalSources.length} Active
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {signalSources.map((src) => (
            <div key={src.name} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[3px] rounded-l-xl dark:block"
                style={{ background: "linear-gradient(to bottom, #afc6ff, #4edea3)" }} aria-hidden="true" />
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">{src.icon}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{src.name}</span>
                </div>
                <span className="shrink-0 rounded border border-emerald-500/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:border-emerald-400/40 dark:text-emerald-400">
                  Active
                </span>
              </div>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-300">{src.description}</p>
              <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-600">{src.params}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Aggregation + Weights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Signal Aggregation</h2>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{aggregationDescription}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Source Weights</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Source</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
              {sourceWeights.map((row) => (
                <tr key={row.source}>
                  <td className="py-1.5 text-gray-700 dark:text-zinc-300">{row.source}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-gray-900 dark:text-zinc-100">{row.weight}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Scoring bands */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">AI Scoring (0–100)</h2>
        <p className="mb-4 text-xs leading-relaxed text-gray-500 dark:text-zinc-500">{scoringDescription}</p>
        <div className="space-y-1.5">
          <div className="flex h-4 overflow-hidden rounded-lg">
            {SCORE_BANDS.map((b) => (
              <div key={b.range} className={`flex-1 ${b.color}`} />
            ))}
          </div>
          <div className="flex">
            {SCORE_BANDS.map((b) => (
              <div key={b.range} className="flex-1 text-center">
                <p className="text-[10px] font-semibold text-gray-600 dark:text-zinc-400">{b.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600">{b.range}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 dark:border-zinc-800/60">
          {scoringBands.map((row) => (
            <div key={row.band} className="flex items-baseline gap-3 text-xs">
              <span className="w-12 shrink-0 font-mono font-semibold text-gray-700 dark:text-zinc-200">{row.band}</span>
              <span className="text-gray-500 dark:text-zinc-400">{row.meaning}</span>
            </div>
          ))}
        </div>
      </div>

      {/* P&D Detection */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Pump &amp; Dump Detection</h2>
        <p className="mb-4 text-xs leading-relaxed text-gray-500 dark:text-zinc-500">{pndDescription}</p>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400">Effective — count toward threshold</p>
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          {effectiveFlags.map((item) => (
            <div key={item.flag} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold whitespace-nowrap text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {item.flag}
              </span>
              <span className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{item.desc}</span>
            </div>
          ))}
        </div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Informational — detected, not counted</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {infoFlags.map((item) => (
            <div key={item.flag} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded border border-gray-300/80 px-1.5 py-0.5 text-[10px] font-mono font-semibold whitespace-nowrap text-gray-500 dark:border-zinc-600/60 dark:text-zinc-400">
                {item.flag}
              </span>
              <span className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stages + Recommendations */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Signal Stages</h2>
          <div className="space-y-3">
            {signalStages.map((item) => (
              <div key={item.stage} className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${item.color}`}>
                  {stageLabel(item.stage)}
                </span>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Recommendations</h2>
          <div className="space-y-3">
            {recommendationLevels.map((item) => (
              <div key={item.level} className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${item.color}`}>
                  {item.level}
                </span>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ML Backtesting */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">ML Backtesting &amp; Continuous Improvement</h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{backtestDescription}</p>
        <div className="flex flex-wrap items-center gap-2">
          {backtestPipeline.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-indigo-400/50 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-400/30 dark:text-indigo-300">
                {step}
              </span>
              {i < backtestPipeline.length - 1 && (
                <span className="text-gray-400 dark:text-zinc-600">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-400 dark:text-zinc-600">{disclaimer}</p>
    </div>
  );
}
