import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function MethodologyPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">How It Works</h1>
        <p className="mt-2 text-sm text-gray-600">
          SignalScope harvests ticker mentions from six signal sources, aggregates them by symbol,
          scores each candidate with AI, runs an 11-flag pump-and-dump filter, and surfaces only
          the tickers with the strongest multi-source backing and verifiable catalysts. The result
          is a prioritised watchlist you can act on before the crowd.
        </p>
      </div>

      {/* Pipeline strip */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {["Sources", "Aggregate", "Score", "Filter", "Validate"].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{step}</span>
                {i < arr.length - 1 && <span className="text-gray-400">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signal Sources */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Signal Sources</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "💬",
                name: "Reddit",
                description: "Monitors 17 investing subreddits for posts and high-engagement comments.",
                params: "Posts + comments · 17 subreddits · 1.5 s delay between requests",
                active: true,
              },
              {
                icon: "🐦",
                name: "X / Twitter",
                description: "Keyword search for ticker mentions from the past 24 hours, run once daily before market open.",
                params: "X API v2 · 24 h lookback · up to 300 tweets/run",
                active: true,
              },
              {
                icon: "📋",
                name: "SEC Insider",
                description: "C-suite open-market purchases of $50 K or more from OpenInsider and EDGAR.",
                params: "C-suite only · $50 K+ purchases · open market only",
                active: true,
              },
              {
                icon: "📈",
                name: "Volume Spike",
                description: "Flags symbols whose volume is ≥2× their 10-day average.",
                params: "110 symbols · ≥2× 10-day avg · Yahoo Finance data",
                active: true,
              },
              {
                icon: "💎",
                name: "Options Flow",
                description: "Unusual call volume, heavy OTM calls, and call sweeps.",
                params: "Requires paid API (Unusual Whales, FlowAlgo)",
                active: false,
              },
              {
                icon: "📣",
                name: "StockTwits",
                description: "Social sentiment from StockTwits posts via mirror.",
                params: "Disabled — Cloudflare blocks all direct access",
                active: false,
              },
            ].map((src) => (
              <div key={src.name} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>{src.icon}</span>
                    <span className="font-medium text-gray-900">{src.name}</span>
                  </div>
                  {src.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{src.description}</p>
                <p className="mt-1 text-xs text-gray-400">{src.params}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aggregation */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Signal Aggregation &amp; Source Weights</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Raw mentions are grouped by ticker symbol. A symbol becomes a candidate when it appears
            ≥2 times from a single source <em>or</em> appears in ≥2 different sources. Each source
            carries a weight that biases the aggregate score.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { source: "SEC Insider", weight: "3.0" },
                  { source: "Options Flow", weight: "2.5" },
                  { source: "Volume Spike", weight: "2.0" },
                  { source: "X / Twitter", weight: "1.2" },
                  { source: "Reddit", weight: "1.0" },
                ].map((row) => (
                  <tr key={row.source}>
                    <td className="py-1.5 pr-4 text-gray-700">{row.source}</td>
                    <td className="py-1.5 font-mono text-gray-900">{row.weight}</td>
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
          <h2 className="text-base font-semibold text-gray-900">AI Scoring (0–100)</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Each candidate is scored by an AI model (GPT-4o or Claude 3.5 Sonnet) using source
            weights, catalyst quality, novelty, and cross-source corroboration. Pure social signals
            (Reddit / StockTwits / Twitter only) never exceed 50 without a verifiable catalyst.
            First-appearance tickers receive a +5–10 novelty boost; tickers seen 3+ times or older
            than 7 days receive a staleness penalty.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="pb-2 pr-4">Band</th>
                  <th className="pb-2">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { band: "80–100", meaning: "Real catalyst + multi-source + insider/options confirmation" },
                  { band: "60–79", meaning: "Real catalyst + ≥2 sources, or strong insider/options alone" },
                  { band: "40–59", meaning: "Social buzz with catalyst indicators (unconfirmed)" },
                  { band: "20–39", meaning: "Social-only signal, no verifiable catalyst" },
                  { band: "0–19", meaning: "Likely noise or pump attempt" },
                ].map((row) => (
                  <tr key={row.band}>
                    <td className="py-1.5 pr-4 font-mono text-gray-900">{row.band}</td>
                    <td className="py-1.5 text-gray-600">{row.meaning}</td>
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
          <h2 className="text-base font-semibold text-gray-900">Pump &amp; Dump Detection</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Every candidate is checked against 10 statistical flags before scoring. A ticker that
            triggers ≥3 flags is moved to <strong>FILTERED</strong> status and quarantined. Exactly
            2 flags triggers an additional AI edge-case assessment.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { flag: "penny_price", desc: "Price below $2" },
              { flag: "otc_listing", desc: "Listed on OTC / Pink Sheets" },
              { flag: "micro_cap_no_catalyst", desc: "Market cap < $50 M with no news" },
              { flag: "only_penny_subs", desc: "Only in r/pennystocks or r/smallstreetbets" },
              { flag: "single_source", desc: "Only one signal source" },
              { flag: "hyperbolic_language", desc: "≥3 hype phrases (\"moon\", \"100×\", \"can't lose\"…)" },
              { flag: "coordinated_posts", desc: "≥50% near-identical post titles" },
              { flag: "no_news_catalyst", desc: "Multiple signals with no verifiable news" },
              { flag: "sudden_spike", desc: "≥3 Reddit signals all <3 h old AND avg upvotes <10" },
              { flag: "twitter_bot_promoters", desc: "Coordinated low-credibility accounts on X" },
            ].map((item) => (
              <div key={item.flag} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-mono font-medium text-red-700 whitespace-nowrap">
                  {item.flag}
                </span>
                <span className="text-sm text-gray-600">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signal Stages */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Signal Stages</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                stage: "EARLY",
                color: "bg-yellow-100 text-yellow-800",
                desc: "Score ≥40, multiple sources or novel ticker. Worth watching but needs confirmation.",
              },
              {
                stage: "FORMING",
                color: "bg-orange-100 text-orange-800",
                desc: "Score ≥45–50 with velocity or multi-source. Catalyst indicators present.",
              },
              {
                stage: "CONFIRMED",
                color: "bg-green-100 text-green-800",
                desc: "Score ≥65–70 with strong multi-source or insider/options backing.",
              },
              {
                stage: "FILTERED",
                color: "bg-red-100 text-red-800",
                desc: "Failed P&D check. Quarantined and visible in the Filtered tab.",
              },
            ].map((item) => (
              <div key={item.stage} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${item.color}`}>
                  {item.stage}
                </span>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendation Levels */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Recommendation Levels</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                level: "Strong Buy",
                color: "bg-green-600 text-white",
                desc: "Real catalyst + insider/options + multi-source corroboration (rare).",
              },
              {
                level: "Buy",
                color: "bg-green-100 text-green-800",
                desc: "Real catalyst with ≥2 corroborating sources.",
              },
              {
                level: "Watch",
                color: "bg-yellow-100 text-yellow-800",
                desc: "Interesting signal that needs further confirmation before acting.",
              },
              {
                level: "Avoid",
                color: "bg-red-100 text-red-800",
                desc: "No verifiable catalyst, pure hype, or P&D risk indicators.",
              },
            ].map((item) => (
              <div key={item.level} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${item.color}`}>
                  {item.level}
                </span>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-400">
        SignalScope is for informational purposes only and does not constitute financial advice.
        Always do your own research before making any investment decisions.
      </p>
    </div>
  );
}
