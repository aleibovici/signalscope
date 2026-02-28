"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Login Page / Landing Page                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-blue-800/30 bg-blue-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-xl font-bold tracking-tight text-white">
            Signal<span className="text-blue-300">Scope</span>
          </span>
          <div className="flex items-center gap-3">
            <a href="#sign-in" className="text-sm font-medium text-blue-200 hover:text-white transition-colors">
              Sign In
            </a>
            <Link
              href="/register"
              className="rounded-md bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero + Login ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 pt-20 pb-12 md:pt-24 md:pb-20">
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 sm:px-6 md:gap-12 lg:flex-row lg:items-start lg:gap-16">
          {/* Left — copy */}
          <div className="max-w-xl text-center lg:pt-6 lg:text-left">
            <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-white md:mb-5 md:text-4xl lg:text-5xl">
              Spot breakout stocks<br />
              <span className="text-blue-300">before the crowd</span>
            </h1>
            <p className="mb-6 text-base leading-relaxed text-blue-100/90 md:mb-8 md:text-lg">
              SignalScope harvests signals from Reddit, X/Twitter, SEC insider filings, and volume spikes — then uses AI to score, filter pump-and-dumps, and surface the tickers most likely to move.
            </p>

            <a
              href="#how-it-works"
              className="inline-block rounded-lg border border-blue-400/40 px-5 py-2.5 text-sm font-semibold text-blue-100 hover:bg-white/10 transition-colors md:px-6"
            >
              How It Works
            </a>

            {/* Quick stats */}
            <div className="mt-8 flex justify-center gap-6 sm:gap-8 md:mt-10 lg:justify-start">
              {[
                ["6", "Signal sources"],
                ["11", "P&D flags"],
                ["4", "Signal stages"],
              ].map(([num, label]) => (
                <div key={label} className="text-center lg:text-left">
                  <p className="text-xl font-bold text-white md:text-2xl">{num}</p>
                  <p className="text-xs text-blue-300">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — login card */}
          <div id="sign-in" className="mx-auto w-full max-w-sm scroll-mt-24 lg:mx-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-lg">
              <h2 className="mb-1 text-xl font-bold text-white">Sign in</h2>
              <p className="mb-5 text-sm text-blue-200">Welcome back</p>

              {error && (
                <div className="mb-4 rounded-md bg-red-500/20 p-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-blue-100">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-300/60 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-300/60 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="Min. 8 characters"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-md hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-blue-200">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-white hover:text-blue-100">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────────── */}
      <section className="bg-white py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Everything you need to find breakouts
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            From raw social chatter to validated, scored signals — SignalScope automates the entire pipeline.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                title: "Multi-source harvesting",
                desc: "Aggregates mentions from Reddit, X/Twitter, SEC insider filings, and volume data in a single scan.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.39.315-2.706.879-3.882" />
                ),
              },
              {
                title: "AI scoring",
                desc: "AI models evaluate every signal for breakout potential with confidence scores and reasoning.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                ),
              },
              {
                title: "Pump & dump filter",
                desc: "11 statistical flags plus AI edge-case assessment to catch and remove manipulated tickers.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                ),
              },
              {
                title: "Signal stages",
                desc: "Signals progress through Early, Forming, Confirmed, and Filtered stages as conviction grows.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 16.5m0 0L12 10.5m4.5 6V3" />
                ),
              },
              {
                title: "Portfolio tracking",
                desc: "Track positions against signals. See cost basis, current price, and P&L in real time.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                ),
              },
              {
                title: "Performance tracking",
                desc: "Automated price snapshots at 1, 3, 7, and 30 days after signal detection to measure accuracy.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
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

      {/* ── How It Works — Pipeline ─────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-16 bg-gray-50 py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-gray-500 md:mb-14 md:text-base">
            Every scan runs through a five-stage pipeline — from raw social data to validated, scored breakout candidates.
          </p>

          {/* Mobile: vertical timeline */}
          <div className="relative mx-auto max-w-xs sm:hidden">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-blue-200" />
            {[
              { step: "1", label: "Harvest", desc: "Scrape Reddit, X/Twitter, SEC filings, and volume data for ticker mentions." },
              { step: "2", label: "Aggregate", desc: "Group signals by symbol, count sources, and calculate mention velocity." },
              { step: "3", label: "Score", desc: "AI models evaluate breakout potential with confidence scores and reasoning." },
              { step: "4", label: "Filter", desc: "11 statistical flags plus AI assessment catch pump-and-dump schemes." },
              { step: "5", label: "Validate", desc: "Surviving tickers get fundamentals, a report, and enter the dashboard." },
            ].map(({ step, label, desc }) => (
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
            {[
              { step: "1", label: "Harvest", desc: "Scrape Reddit, X/Twitter, SEC filings, and volume data for ticker mentions." },
              { step: "2", label: "Aggregate", desc: "Group signals by symbol, count sources, and calculate mention velocity." },
              { step: "3", label: "Score", desc: "AI models evaluate breakout potential with confidence scores and reasoning." },
              { step: "4", label: "Filter", desc: "11 statistical flags plus AI assessment catch pump-and-dump schemes." },
              { step: "5", label: "Validate", desc: "Surviving tickers get fundamentals, a report, and enter the dashboard." },
            ].map(({ step, label, desc }, i) => (
              <div key={label} className="relative flex flex-col items-center text-center px-4 py-6">
                {/* Connector line */}
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

          <p className="mt-8 text-center text-sm text-gray-500 md:mt-10">
            Detailed scoring weights, AI prompts, and filtering methodology are available on the Methodology page after signing in.
          </p>
        </div>
      </section>

      {/* ── Signal Sources ──────────────────────────────────────── */}
      <section className="bg-white py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Signal sources
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-gray-500 md:mb-12 md:text-base">
            Four active data feeds monitored on every scan.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {[
              {
                name: "Reddit",
                desc: "Monitors r/wallstreetbets, r/stocks, r/pennystocks, and other communities for trending tickers.",
                tag: "Social",
                tagColor: "bg-orange-100 text-orange-700",
              },
              {
                name: "X / Twitter",
                desc: "Searches X API v2 for stock-related posts from finance accounts and trending discussions.",
                tag: "Social",
                tagColor: "bg-sky-100 text-sky-700",
              },
              {
                name: "SEC Insider",
                desc: "Tracks C-suite insider purchases over $50K from OpenInsider and EDGAR RSS feeds.",
                tag: "Filings",
                tagColor: "bg-emerald-100 text-emerald-700",
              },
              {
                name: "Volume Spike",
                desc: "Flags stocks trading at 2x+ their average volume — a classic breakout precursor.",
                tag: "Technical",
                tagColor: "bg-violet-100 text-violet-700",
              },
            ].map(({ name, desc, tag, tagColor }) => (
              <div
                key={name}
                className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor}`}>
                    {tag}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-gray-900 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <span className="text-sm font-bold text-white">
            Signal<span className="text-blue-400">Scope</span>
          </span>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            Not financial advice. SignalScope is a research tool — always do your own due diligence before making investment decisions.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            &copy; {new Date().getFullYear()} SignalScope. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
