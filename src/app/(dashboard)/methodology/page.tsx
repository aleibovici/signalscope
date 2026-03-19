import { stageLabel } from "@/lib/stage-labels";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function PipelineStrip({ steps, pillClass }: { steps: readonly string[]; pillClass: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 ${pillClass}`}>{step}</span>
          {i < steps.length - 1 && <span className="text-gray-400 dark:text-zinc-500">→</span>}
        </div>
      ))}
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl dark:text-zinc-100">How It Works</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{methodologyDescription}</p>
      </div>

      {/* Pipeline strip */}
      <Card>
        <CardContent>
          <PipelineStrip steps={pipelineSteps} pillClass="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">{scoreExplainerMethodologyTitle}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-zinc-300">{scoreExplainerMethodologyBody}</p>
        </CardContent>
      </Card>

      {/* Signal Sources */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Signal Sources</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signalSources.map((src) => (
              <div key={src.name} className="rounded-lg border border-gray-200 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>{src.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-zinc-100">{src.name}</span>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300">
                    Active
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-300">{src.description}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{src.params}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aggregation */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Signal Aggregation &amp; Source Weights</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">{aggregationDescription}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {sourceWeights.map((row) => (
                  <tr key={row.source}>
                    <td className="py-1.5 pr-4 text-gray-700 dark:text-zinc-300">{row.source}</td>
                    <td className="py-1.5 font-mono text-gray-900 dark:text-zinc-100">{row.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Scoring */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">AI Scoring (0–100)</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">{scoringDescription}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="pb-2 pr-4">Band</th>
                  <th className="pb-2">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {scoringBands.map((row) => (
                  <tr key={row.band}>
                    <td className="py-1.5 pr-4 font-mono text-gray-900 dark:text-zinc-100">{row.band}</td>
                    <td className="py-1.5 text-gray-600 dark:text-zinc-300">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* P&D Detection */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Pump &amp; Dump Detection</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">{pndDescription}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pndFlags.map((item) => (
              <div key={item.flag} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-mono font-medium whitespace-nowrap text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  {item.flag}
                </span>
                <span className="text-sm text-gray-600 dark:text-zinc-300">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signal Stages */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Signal Stages</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {signalStages.map((item) => (
              <div key={item.stage} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-zinc-700 dark:bg-zinc-900/30">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${item.color}`}>
                  {stageLabel(item.stage)}
                </span>
                <p className="text-sm text-gray-600 dark:text-zinc-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendation Levels */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Recommendation Levels</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendationLevels.map((item) => (
              <div key={item.level} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-zinc-700 dark:bg-zinc-900/30">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${item.color}`}>
                  {item.level}
                </span>
                <p className="text-sm text-gray-600 dark:text-zinc-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ML Backtesting */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">ML Backtesting &amp; Continuous Improvement</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">{backtestDescription}</p>

          <PipelineStrip steps={backtestPipeline} pillClass="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" />

        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-400 dark:text-zinc-500">{disclaimer}</p>
    </div>
  );
}
