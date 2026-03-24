"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { EmergingReturnsChart } from "@/components/emerging-returns-chart";

/* ------------------------------------------------------------------ */
/*  Login Page / Landing Page                                          */
/* ------------------------------------------------------------------ */

const howItWorksSteps = [
  { step: "1", label: "Discover", desc: "Monitor Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, and volume data for ticker mentions." },
  { step: "2", label: "Aggregate", desc: "Group signals by symbol, count sources, and calculate mention velocity." },
  { step: "3", label: "Score", desc: "AI assigns signal confidence (evidence strength) and an Opportunity score (early-mover potential) — high confidence can mean the crowd already agrees." },
  { step: "4", label: "Filter", desc: "13 statistical flags plus AI assessment catch pump-and-dump schemes." },
  { step: "5", label: "Validate", desc: "Surviving tickers get fundamentals, a report, and enter the dashboard." },
];

interface PerfStats {
  totalTracked: number;
  signalsWithReturns: number;
  winRate: number;
  avgReturn: number;
  emergingWinRate: number;
  emergingAvgReturn: number;
  emergingCount: number;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);

  useEffect(() => {
    fetch("/api/stats/performance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.signalsWithReturns > 0) setPerfStats(d); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* -- Nav ---------------------------------------------------- */}
      <nav className="fixed top-0 z-50 w-full border-b border-blue-800/30 bg-blue-900/80 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-xl font-bold tracking-tight text-white">
            Signal<span className="text-blue-300">Scope</span>
          </span>
          <div className="flex items-center gap-3">
            <a href="#sign-in" className="text-sm font-medium text-blue-200 hover:text-white transition-colors touch-manipulation">
              Sign In
            </a>
            <Link
              href="/register"
              className="rounded-md bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors touch-manipulation"
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* -- Hero + Login ------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 pt-20 pb-10 md:pt-24 md:pb-20">
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative mx-auto flex max-w-6xl flex-col-reverse items-center gap-8 px-4 sm:px-6 md:gap-12 lg:flex-row lg:items-start lg:gap-16">
          {/* Left -- copy (appears BELOW login card on mobile due to flex-col-reverse) */}
          <div className="max-w-xl text-center lg:pt-6 lg:text-left">
            <h1 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl md:mb-5 md:text-4xl lg:text-5xl">
              Spot breakout stocks<br />
              <span className="text-blue-300">before the crowd</span>
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-blue-100/90 sm:text-base md:mb-8 md:text-lg">
              SignalScope monitors Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, and volume spikes — then uses AI to score, filter pump-and-dumps, and surface the tickers most likely to move.
            </p>

            {/* Perf stats inline badges (social proof above fold on desktop) */}
            {perfStats && (
              <div className="mb-5 flex flex-wrap justify-center gap-2 sm:gap-3 md:mb-8 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 sm:text-sm">
                  {perfStats.totalTracked} tickers tracked
                </span>
              </div>
            )}

            <div className="flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/dashboard"
                className="w-full rounded-lg bg-white px-6 py-2.5 text-center text-sm font-semibold text-blue-700 shadow-md hover:bg-blue-50 transition-colors touch-manipulation sm:w-auto"
              >
                Browse signals
              </Link>
              <Link
                href="/register"
                className="w-full rounded-lg border border-blue-400/40 px-5 py-2.5 text-center text-sm font-semibold text-blue-100 hover:bg-white/10 transition-colors touch-manipulation sm:w-auto"
              >
                Create account
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-6 flex justify-center gap-6 sm:gap-8 md:mt-8 lg:justify-start">
              {[
                ["7", "Signal sources"],
                ["13", "P&D flags"],
                ["4", "Signal stages"],
              ].map(([num, label]) => (
                <div key={label} className="text-center lg:text-left">
                  <p className="text-lg font-bold text-white sm:text-xl md:text-2xl">{num}</p>
                  <p className="text-xs text-blue-300">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right -- login card (appears FIRST on mobile due to flex-col-reverse) */}
          <div id="sign-in" className="mx-auto w-full max-w-sm scroll-mt-24 lg:mx-0 lg:shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-blue-950/40 backdrop-blur-lg sm:p-6">
              <h2 className="mb-1 text-xl font-bold text-white">Sign in</h2>
              <p className="mb-4 text-sm text-blue-200 sm:mb-5">Welcome back</p>

              {error && (
                <div className="mb-4 rounded-md bg-red-500/20 p-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-blue-100">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-blue-300/60 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-blue-100">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-blue-300/60 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="Min. 8 characters"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-md hover:bg-blue-50 disabled:opacity-50 transition-colors touch-manipulation"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-blue-200 sm:mt-5">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-white hover:text-blue-100">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -- Agent callout strip ------------------------------------ */}
      <div className="border-y border-violet-100 bg-violet-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">🤖</span>
            <p className="text-sm text-violet-800">
              <span className="font-semibold">AI agent?</span>
              {" "}Access live breakout signal data via x402 micropayments — no account or signup required.
            </p>
          </div>
          <a
            href="/skill/SKILL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors touch-manipulation"
          >
            View API docs →
          </a>
        </div>
      </div>

      {/* -- Features Grid ------------------------------------------ */}
      <section className="bg-white py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Everything you need to find breakouts
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            From raw social chatter to validated, scored signals — SignalScope automates the entire pipeline.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                title: "Multi-source monitoring",
                desc: "Aggregates signals from 7 sources — Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, and volume data — in a single scan.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.39.315-2.706.879-3.882" />
                ),
              },
              {
                title: "AI scoring & ML backtesting",
                desc: "Dual scores: Opportunity (timing / early alpha) and AI confidence (how strong the evidence is). XGBoost + SHAP continuously refine thresholds as data grows.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                ),
              },
              {
                title: "Pump & dump filter",
                desc: "13 statistical flags plus AI edge-case assessment to catch and remove manipulated tickers before they reach the dashboard.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                ),
              },
              {
                title: "Signal stages",
                desc: "Signals progress through Emerging, Building, Consensus, and Filtered stages as conviction grows across sources.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 16.5m0 0L12 10.5m4.5 6V3" />
                ),
              },
              {
                title: "Performance & trending",
                desc: "Automated price snapshots at 1d, 3d, 7d, and 30d. Cross-scan trending shows which tickers are gaining or losing momentum.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                ),
              },
              {
                title: "AI Agent & x402 payments",
                desc: "Connect any LLM via the Agent Skill or access data instantly via the x402 protocol — pay per call in USDC on Base, no registration required.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                ),
              },
            ].map(({ title, desc, icon }) => (
              <div
                key={title}
                className="group rounded-xl border border-gray-100 bg-gray-50/50 p-5 transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md sm:p-6"
              >
                <span className="mb-4 inline-flex rounded-lg bg-blue-100 p-2.5 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    {icon}
                  </svg>
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- How It Works -- Pipeline ------------------------------ */}
      <section id="how-it-works" className="scroll-mt-16 bg-gray-50 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-gray-500 md:mb-14 md:text-base">
            Every scan runs through a five-stage pipeline — from raw social data to validated, scored breakout candidates.
          </p>

          {/* Mobile: vertical timeline */}
          <div className="relative mx-auto max-w-sm sm:hidden">
            <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-blue-200" />
            {howItWorksSteps.map(({ step, label, desc }) => (
              <div key={label} className="relative flex items-start gap-4 py-3">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {step}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
                  <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: horizontal pipeline */}
          <div className="hidden sm:grid sm:grid-cols-5">
            {howItWorksSteps.map(({ step, label, desc }, i) => (
              <div key={label} className="relative flex flex-col items-center text-center px-4 py-6">
                {i < 4 && (
                  <div className="pointer-events-none absolute right-0 top-10 h-0.5 w-full translate-x-1/2 bg-blue-200" />
                )}
                <span className="relative z-10 mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {step}
                </span>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">{label}</h3>
                <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500 md:mt-10">
            Detailed scoring weights, AI prompts, and filtering methodology are available on the Methodology page after signing in.
          </p>
        </div>
      </section>

      {/* -- Signal Sources ----------------------------------------- */}
      <section className="bg-white py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Signal sources
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            Seven data feeds monitored on every scan — from social chatter to institutional filings.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
            {[
              { name: "Reddit", tag: "Social", tagColor: "bg-orange-100 text-orange-700", desc: "17 subreddits including r/wallstreetbets, r/stocks, and r/pennystocks." },
              { name: "X / Twitter", tag: "Social", tagColor: "bg-sky-100 text-sky-700", desc: "X API v2 searches for stock-related trending discussions." },
              { name: "StockTwits", tag: "Social", tagColor: "bg-amber-100 text-amber-700", desc: "Trending tickers for real-time retail sentiment." },
              { name: "SEC Insider", tag: "Filings", tagColor: "bg-emerald-100 text-emerald-700", desc: "C-suite purchases over $50K from OpenInsider and EDGAR." },
              { name: "Congress", tag: "Filings", tagColor: "bg-emerald-100 text-emerald-700", desc: "Congressional stock purchases from STOCK Act disclosures." },
              { name: "Options Flow", tag: "Institutional", tagColor: "bg-blue-100 text-blue-700", desc: "Unusual call volume, OTM activity, and call sweeps." },
              { name: "Volume Spike", tag: "Technical", tagColor: "bg-violet-100 text-violet-700", desc: "Stocks trading at 2x+ average volume." },
            ].map(({ name, desc, tag, tagColor }) => (
              <div
                key={name}
                className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-blue-200 hover:shadow-md sm:p-5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{name}</h3>
                  <span className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${tagColor}`}>
                    {tag}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-500 sm:text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- ML Backtesting ----------------------------------------- */}
      <section className="bg-gray-50 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Continuously learning
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            SignalScope doesn&apos;t just detect signals — it measures what happens next and feeds the results back into the model.
          </p>

          <div className="mx-auto max-w-4xl">
            {/* Pipeline diagram -- clean vertical on mobile, horizontal on desktop */}
            <div className="mb-6 flex flex-col items-center gap-0 sm:flex-row sm:justify-center sm:gap-0 md:mb-12">
              {[
                { label: "Track prices", sub: "Automated snapshots at open & close" },
                { label: "Measure returns", sub: "1d, 3d, 7d, 30d after detection" },
                { label: "Train model", sub: "XGBoost gradient boosted ML" },
                { label: "Optimize", sub: "Refine thresholds & filters" },
              ].map(({ label, sub }, i) => (
                <div key={label} className="flex flex-col items-center sm:flex-col sm:gap-0">
                  {i > 0 && (
                    <>
                      <span className="my-1 text-lg text-blue-400 sm:hidden">&#8595;</span>
                      <span className="hidden text-blue-400 sm:mb-2 sm:block">&#8594;</span>
                    </>
                  )}
                  <div className="w-56 rounded-lg border border-blue-200 bg-white px-4 py-3 text-center shadow-sm sm:mx-2 sm:w-40">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-gray-500">
              Every signal&apos;s real-world outcome is tracked and fed back into the model — so scoring, filtering, and stage assignments get smarter over time.
            </p>
          </div>
        </div>
      </section>

      {/* -- Agent Skill / API -------------------------------------- */}
      <section className="bg-white py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Built for AI agents
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            Two ways to give your AI access to live breakout signal data — no account required to get started.
          </p>

          <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-2">

            {/* x402 path */}
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                  {/* Lightning bolt */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">x402 micropayments</h3>
                  <p className="text-xs font-medium text-blue-600">No registration needed</p>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                The <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">x402 protocol</a> lets AI agents pay per call in USDC on Base — no account, no API key, no subscription. Just send the request and pay the 402.
              </p>

              <ul className="mb-5 space-y-2 text-sm text-gray-600">
                {[
                  "From $0.005 per data call",
                  "USDC on Base (L2) — near-zero gas",
                  "Atomic: only charged on success",
                  "Works with any x402-compatible client",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="rounded-lg bg-gray-900 px-4 py-3 font-mono text-xs text-gray-300 overflow-x-auto">
                <span className="text-gray-500"># Agent hits endpoint → gets 402 → pays → gets data</span>{"\n"}
                <span className="text-blue-400">curl</span> http://localhost:3000/api/tickers/trending{"\n"}
                <span className="text-gray-500">→ HTTP 402  payment-required: ey...</span>
              </div>

              <a
                href="/skill/SKILL.md"
                target="_blank"
                className="mt-4 inline-block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors touch-manipulation"
              >
                View API docs
              </a>
            </div>

            {/* API key path */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-700 text-white">
                  {/* Key icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a.75.75 0 0 0-.878.68l-.005 3a.75.75 0 0 0 .75.75H6a.75.75 0 0 0 .75-.75v-.75h.75a.75.75 0 0 0 .75-.75v-.75h.75a.75.75 0 0 0 .53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1 0 15.75 1.5Zm0 3a.75.75 0 0 0 0 1.5A2.25 2.25 0 0 1 18 8.25a.75.75 0 0 0 1.5 0 3.75 3.75 0 0 0-3.75-3.75Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">API key + Agent Skill</h3>
                  <p className="text-xs font-medium text-gray-500">For registered users</p>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                Register for full access including portfolio management, watchlists, and performance tracking. Connect any LLM via the Agent Skill.
              </p>

              <div className="mb-5 space-y-3">
                {[
                  { step: "1", label: "Register", desc: "Create a free account — no credit card needed." },
                  { step: "2", label: "Get API key", desc: "Generate a key from your Profile page in one click." },
                  { step: "3", label: "Install skill", desc: "Add the Agent Skill to Claude, ChatGPT, or any LLM." },
                ].map(({ step, label, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="/skill/SKILL.md"
                  target="_blank"
                  className="inline-block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
                >
                  Download Agent Skill
                </a>
                <p className="text-center text-xs text-gray-400">
                  Full access: signals, portfolio, watchlist, performance
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* -- CTA Banner -------------------------------------------- */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-700 py-10 md:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="mb-3 text-xl font-bold text-white sm:text-2xl md:text-3xl">
            Ready to find the next breakout?
          </h2>
          <p className="mb-5 text-sm text-blue-200 md:text-base">
            Free to use. No credit card required.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-blue-700 shadow-md hover:bg-blue-50 transition-colors touch-manipulation sm:text-base"
          >
            Browse signals
          </Link>
        </div>
      </section>

      {/* -- Footer ------------------------------------------------- */}
      <footer className="bg-gray-900 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <span className="text-sm font-bold text-white">
              Signal<span className="text-blue-400">Scope</span>
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
              <Link href="/blog" className="hover:text-gray-300 transition-colors touch-manipulation">Blog</Link>
              <Link href="/faq" className="hover:text-gray-300 transition-colors touch-manipulation">FAQ</Link>
              <Link href="/how-it-works" className="hover:text-gray-300 transition-colors touch-manipulation">Methodology</Link>
              <Link href="/changelog" className="hover:text-gray-300 transition-colors touch-manipulation">Changelog</Link>
              <a href="/skill/SKILL.md" target="_blank" className="hover:text-gray-300 transition-colors touch-manipulation">API Docs</a>
              <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors touch-manipulation">x402 Protocol</a>
              <a href="https://x.com/signalscopes" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors touch-manipulation">𝕏 @signalscopes</a>
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-gray-500 sm:text-left">
            Not financial advice. SignalScope is a research tool — always do your own due diligence before making investment decisions.
          </p>
          <p className="mt-2 text-center text-xs text-gray-600 sm:text-left">
            &copy; {new Date().getFullYear()} SignalScope. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
