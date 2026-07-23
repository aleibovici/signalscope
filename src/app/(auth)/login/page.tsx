"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { absoluteUrl } from "@/lib/site-url";
/* ------------------------------------------------------------------ */
/*  Login Page / Landing Page                                          */
/* ------------------------------------------------------------------ */

const howItWorksSteps = [
  { step: "1", label: "Listen", desc: "Scan Reddit, X, StockTwits, SEC filings, Congress trades, options flow, volume, and Polymarket for every ticker mention and catalyst." },
  { step: "2", label: "Group", desc: "Cluster by symbol, count independent sources, and measure how fast mentions are accelerating." },
  { step: "3", label: "Score", desc: "AI rates the evidence (confidence) and ranks how early you are (Opportunity score) — the earlier, the bigger the edge." },
  { step: "4", label: "Filter", desc: "13 statistical flags plus an AI review strip out pump-and-dump patterns before anything reaches you." },
  { step: "5", label: "Deliver", desc: "Survivors get fundamentals, a full report, and a clear trade setup on the dashboard." },
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

const SOURCE_CARDS = [
  { name: "Reddit", glyph: "🔥", tag: "Social", tagColor: "border-orange-500/25 bg-orange-500/15 text-orange-300", desc: "17 subreddits including r/wallstreetbets, r/stocks, and r/pennystocks." },
  { name: "X / Twitter", glyph: "𝕏", tag: "Social", tagColor: "border-sky-500/25 bg-sky-500/15 text-sky-300", desc: "X API v2 searches for stock-related trending discussions." },
  { name: "StockTwits", glyph: "💬", tag: "Social", tagColor: "border-amber-500/25 bg-amber-500/15 text-amber-300", desc: "Trending tickers for real-time retail sentiment." },
  { name: "SEC Insider", glyph: "📄", tag: "Filings", tagColor: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300", desc: "C-suite purchases over $50K from OpenInsider and EDGAR." },
  { name: "Congress", glyph: "🏛️", tag: "Filings", tagColor: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300", desc: "Congressional stock purchases from STOCK Act disclosures." },
  { name: "Options Flow", glyph: "📈", tag: "Institutional", tagColor: "border-blue-500/25 bg-blue-500/15 text-blue-300", desc: "Unusual call volume, OTM activity, call sweeps, and net premium flow." },
  { name: "Volume Spike", glyph: "⚡", tag: "Technical", tagColor: "border-violet-500/25 bg-violet-500/15 text-violet-300", desc: "Stocks trading at 2x+ average volume." },
  { name: "Polymarket", glyph: "🎲", tag: "Prediction", tagColor: "border-purple-500/25 bg-purple-500/15 text-purple-300", desc: "Active prediction markets for price targets, earnings, mergers, FDA approvals, and S&P 500 inclusions." },
];

interface LoginPageProps {
  heroPreview?: React.ReactNode;
}

export default function LoginPage({ heroPreview }: LoginPageProps = {}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);
  const { status } = useSession();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const showGuestMobileBar = status !== "authenticated";

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
      await trackConversion("login", { method: "credentials" });
      window.location.href = "/dashboard";
    }
  }

  const showPreview = !isLoginRoute && !!heroPreview;

  const signInCard = (
    <div id="sign-in" className="mx-auto w-full max-w-sm scroll-mt-24 lg:mx-0 lg:shrink-0">
      <div className="rounded-2xl border border-white/15 bg-zinc-900/55 p-5 shadow-[0_0_48px_-12px_rgba(56,189,248,0.2)] backdrop-blur-xl ring-1 ring-white/10 sm:p-6">
        <h2 className="sr-only">Sign in</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/50 bg-zinc-950/50 px-3 py-2.5 text-sm text-white placeholder-zinc-500 shadow-inner focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-300">
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
              className="w-full rounded-lg border border-zinc-600/50 bg-zinc-950/50 px-3 py-2.5 text-sm text-white placeholder-zinc-500 shadow-inner focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-xs text-zinc-400 hover:text-white transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 transition-colors touch-manipulation"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm sm:mt-5">
          <Link href="/register" className="font-semibold text-zinc-300 hover:text-white">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );

  const perfChips = (
    <div className="mb-5 min-h-[2.25rem] flex flex-wrap justify-center gap-2 sm:gap-3 md:mb-8 lg:justify-start">
      {perfStats ? (
        <>
          {perfStats.emergingCount > 0 && (
            <>
              <span
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-[0_0_12px_-4px_rgba(52,211,153,0.25)] sm:text-sm"
                title="High-confidence picks (AI score ≥70) from the last 30 days — same cohort shown on /results"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" style={{ animationDuration: "2.5s" }} />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {Math.round(perfStats.emergingWinRate * 100)}% 7d win rate
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/12 px-3 py-1.5 text-xs font-semibold text-sky-200 shadow-[0_0_12px_-4px_rgba(56,189,248,0.25)] sm:text-sm"
                title="Average return measured 7 days after detection, for high-confidence picks (AI ≥70) from the last 30 days"
              >
                {perfStats.emergingAvgReturn >= 0 ? "+" : ""}
                {(perfStats.emergingAvgReturn * 100).toFixed(1)}% 7d avg return
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 sm:text-sm">
            {perfStats.totalTracked.toLocaleString()} tickers tracked
          </span>
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-zinc-500 sm:text-sm">
          Loading live stats…
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100${showGuestMobileBar ? " pb-19 lg:pb-0" : ""}`}
    >
      {/* -- Nav ---------------------------------------------------- */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-zinc-950/90 shadow-[0_1px_0_0_rgba(56,189,248,0.08)] backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold tracking-tight text-white">
              Signal<span className="text-sky-400">Scope</span>
            </span>
            <div className="hidden items-center gap-4 md:flex">
              <Link href="/blog" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Blog</Link>
              <Link href="/faq" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">FAQ</Link>
              <Link href="/how-it-works" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Methodology</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status === "authenticated" ? (
              <>
                <Link href="/dashboard" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors touch-manipulation">
                  Dashboard
                </Link>
                <button
                  onClick={() =>
                    fetch("/api/auth/csrf")
                      .then((r) => r.json())
                      .then(({ csrfToken }) =>
                        fetch("/api/auth/signout", {
                          method: "POST",
                          headers: { "Content-Type": "application/x-www-form-urlencoded" },
                          body: new URLSearchParams({ csrfToken }),
                        })
                      )
                      .finally(() => { window.location.reload(); })
                  }
                  className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/15 transition-colors touch-manipulation cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={showPreview ? "/login" : "#sign-in"}
                  className="rounded-lg border border-white/20 px-3.5 py-1.5 text-sm font-medium text-zinc-200 hover:border-white/30 hover:bg-white/5 transition-colors touch-manipulation"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/15 transition-colors touch-manipulation"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main id="main-scroll">
      {/* -- Hero + Preview / Login -------------------------------- */}
      <section className="relative overflow-hidden bg-zinc-950 pt-20 pb-10 md:pt-24 md:pb-20">
        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.1) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-zinc-950 via-zinc-950/96 to-blue-950/55" />
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-sky-500/12 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -right-20 h-80 w-80 -translate-y-1/2 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[min(100%,72rem)] -translate-x-1/2 bg-linear-to-r from-transparent via-sky-500/30 to-transparent" />
        {/* Decorative signal-ping dots — desktop only */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <span className="absolute left-[12%] top-[28%] h-2 w-2 animate-ping rounded-full bg-sky-400 opacity-20" style={{ animationDuration: "3.8s" }} />
          <span className="absolute left-[22%] top-[62%] h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400 opacity-15" style={{ animationDelay: "1.4s", animationDuration: "4.2s" }} />
          <span className="absolute left-[8%] top-[48%] h-1 w-1 animate-ping rounded-full bg-violet-400 opacity-15" style={{ animationDelay: "2.1s", animationDuration: "5s" }} />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 sm:px-6 md:gap-12 lg:flex-row lg:items-start lg:gap-16">
          {/* Left -- copy */}
          <div className="max-w-xl text-center lg:min-w-0 lg:flex-1 lg:border-r lg:border-white/10 lg:pr-12 lg:pt-6 lg:text-left">
            <h1 className="mb-3 text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl md:mb-5 md:text-5xl lg:text-6xl">
              Spot breakout stocks<br />
              <span className="bg-linear-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">before the crowd</span>
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-zinc-300 sm:text-base md:mb-8 md:text-lg">
              AI-scored signals from eight data sources — social, insider filings, Congress, options flow, and prediction markets — with pump-and-dump filtering and a public ML backtest.
            </p>

            {perfChips}

            <div className="hidden flex-col items-center gap-3 sm:flex-row lg:flex lg:justify-start">
              <Link
                href="/dashboard"
                className="w-full rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-6 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:from-sky-400 hover:to-blue-500 transition-colors touch-manipulation sm:w-auto"
              >
                See live signals
              </Link>
              <Link
                href="/register"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10 transition-colors touch-manipulation sm:w-auto"
              >
                Create free account
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-zinc-500 lg:justify-start">
              {["Watchlist", "Portfolio tracking", "Full dashboard", "Weekly digest"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1">
                  <svg className="h-3 w-3 shrink-0 text-emerald-500/80" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  {b}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-center text-[11px] text-zinc-600 lg:text-left">
              Free — no credit card required.
            </p>

            <Link
              href="/register"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200 transition-colors hover:border-violet-500/50 hover:bg-violet-500/20"
            >
              <span aria-hidden>🎁</span>
              Tweet about us → 1 month Pro free
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Right -- live preview (homepage) or sign-in (login route) */}
          {showPreview ? heroPreview : signInCard}
        </div>

      </section>

      {/* -- Agent callout strip (hoisted above features) ---------- */}
      <div className="border-y border-violet-900/50 bg-violet-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="shrink-0 text-lg leading-none" aria-hidden>🤖</span>
            <p className="min-w-0 text-sm text-violet-200/90">
              <span className="font-semibold text-violet-100">AI agent?</span>
              {" "}Access live breakout signal data via x402 micropayments — no account or signup required.
            </p>
          </div>
          <a
            href="/skill/SKILL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 self-start rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors touch-manipulation sm:self-auto"
          >
            View API docs →
          </a>
        </div>
      </div>

      {/* -- Features Grid ------------------------------------------ */}
      <section className="border-t border-white/6 bg-zinc-900 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="h-px w-10 bg-linear-to-r from-sky-500 to-blue-500" />
          </div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            Everything you need to find breakouts
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-zinc-400 md:mb-12 md:text-base">
            From raw social chatter to validated, scored signals — SignalScope automates the entire pipeline.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                title: "Multi-source monitoring",
                desc: "Aggregates signals from 8 sources — Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, volume data, and Polymarket prediction markets — in a single scan.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.39.315-2.706.879-3.882" />
                ),
              },
              {
                title: "AI scoring & ML backtesting",
                desc: "Two scores: AI confidence (how strong the evidence is) and Opportunity (how early you are). A public LightGBM backtest continuously refines thresholds as data grows.",
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
                desc: "Signals progress through Emerging, Building, Consensus, and Filtered as conviction grows across sources.",
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
                title: "Agent API & x402 payments",
                desc: "Connect any compatible LLM or automation client via the downloadable skill file, or access data instantly via the x402 protocol — pay per call in USDC on Base, no registration required.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                ),
              },
            ].map(({ title, desc, icon }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/4 p-5 transition-all hover:border-sky-500/40 hover:bg-white/6 hover:shadow-[0_0_32px_-8px_rgba(56,189,248,0.2)] sm:p-6"
              >
                {/* Hover top accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-500/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="mb-4 inline-flex rounded-lg bg-sky-500/15 p-2.5 text-sky-400 transition-all group-hover:bg-sky-500/20 group-hover:text-sky-300 group-hover:shadow-[0_0_16px_-4px_rgba(56,189,248,0.4)]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    {icon}
                  </svg>
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- How It Works -- Pipeline ------------------------------ */}
      <section id="how-it-works" className="scroll-mt-16 border-t border-white/6 bg-zinc-950 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="h-px w-10 bg-linear-to-r from-sky-500 to-blue-500" />
          </div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-zinc-400 md:mb-14 md:text-base">
            Every scan runs through a five-stage pipeline — from raw social data to validated, scored breakout candidates.
          </p>

          <div className="relative mx-auto max-w-sm sm:hidden">
            <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-linear-to-b from-sky-500/40 via-sky-500/20 to-transparent" />
            {howItWorksSteps.map(({ step, label, desc }) => (
              <div key={label} className="relative flex items-start gap-4 py-3">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-sky-900/40 ring-4 ring-sky-500/15">
                  {step}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                  <p className="text-xs leading-relaxed text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:grid sm:grid-cols-5">
            {howItWorksSteps.map(({ step, label, desc }, i) => (
              <div key={label} className="relative flex flex-col items-center text-center px-2 py-6">
                {/* Watermark step number */}
                <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 select-none text-[3.5rem] font-black leading-none text-white/[0.06]">
                  {step}
                </span>
                {i < 4 && (
                  <div className="pointer-events-none absolute right-0 top-[2.75rem] h-px w-full translate-x-1/2 bg-linear-to-r from-sky-500/35 via-sky-500/20 to-transparent" />
                )}
                <span className="relative z-10 mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-sky-900/40 ring-4 ring-sky-500/15">
                  {step}
                </span>
                <h3 className="mb-1 text-sm font-semibold text-white">{label}</h3>
                <p className="text-xs leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 md:mt-10">
            Detailed scoring weights, AI prompts, and filtering methodology are available on the public{" "}
            <a href="/methodology" className="font-medium text-sky-400 hover:text-sky-300 hover:underline">
              Methodology page
            </a>
            .
          </p>
        </div>
      </section>

      {/* -- Signal Sources ----------------------------------------- */}
      <section className="border-t border-white/6 bg-zinc-900 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="h-px w-10 bg-linear-to-r from-sky-500 to-blue-500" />
          </div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            Signal sources
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-zinc-400 md:mb-12 md:text-base">
            Eight data feeds monitored on every scan — from social chatter to institutional filings and prediction markets.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
            {SOURCE_CARDS.map(({ name, desc, tag, tagColor, glyph }) => (
              <div
                key={name}
                className="group rounded-xl border border-white/10 bg-white/4 p-4 transition-all hover:border-white/20 hover:bg-white/6 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)] sm:p-5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none shrink-0" aria-hidden>{glyph}</span>
                    <h3 className="text-sm font-semibold text-white sm:text-base">{name}</h3>
                  </div>
                  <span className={`hidden rounded-full border px-2 py-0.5 text-xs font-medium sm:inline ${tagColor}`}>
                    {tag}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            Source weights, scoring formulas, and per-source heuristics are explained on the{" "}
            <a href="/methodology" className="font-medium text-sky-400 hover:text-sky-300 hover:underline">
              methodology page
            </a>
            .
          </p>
        </div>
      </section>

      {/* -- ML Backtesting ----------------------------------------- */}
      <section className="border-t border-white/6 bg-zinc-950 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="h-px w-10 bg-linear-to-r from-sky-500 to-blue-500" />
          </div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            Continuously learning
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-zinc-400 md:mb-12 md:text-base">
            SignalScope doesn&apos;t just detect signals — it measures what happens next and feeds the results back into the model.
          </p>

          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex flex-col items-center gap-0 sm:flex-row sm:justify-center sm:gap-0 md:mb-12">
              {[
                { label: "Track prices", sub: "Automated snapshots 3× daily", accent: "bg-sky-500" },
                { label: "Measure returns", sub: "1d, 3d, 7d, 30d after detection", accent: "bg-emerald-500" },
                { label: "Train model", sub: "LightGBM with feature importance", accent: "bg-violet-500" },
                { label: "Optimize", sub: "Refine thresholds & filters", accent: "bg-amber-500" },
              ].map(({ label, sub, accent }, i, arr) => (
                <div key={label} className="flex flex-col items-center sm:flex-col sm:gap-0">
                  {i > 0 && (
                    <>
                      <span className="my-1.5 text-sky-500/70 sm:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" /></svg>
                      </span>
                      <span className="hidden text-sky-500/70 sm:mb-2 sm:flex sm:items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
                      </span>
                    </>
                  )}
                  <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 text-center shadow-inner ring-1 ring-white/5 sm:mx-2 sm:w-40">
                    <div className={`h-0.5 w-full ${accent}`} />
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
                    </div>
                  </div>
                  {i === arr.length - 1 && (
                    <p className="mt-3 text-[11px] text-zinc-600 sm:hidden">↺ cycle repeats each scan</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mb-2 hidden text-center text-[11px] text-zinc-600 sm:block">↺ cycle repeats each scan</p>

            <p className="text-center text-sm text-zinc-500">
              Every signal&apos;s real-world outcome is tracked and fed back into the model. Read the full story in{" "}
              <Link href="/blog/ml-model-evolution-xgboost-to-lightgbm" className="font-medium text-sky-400 hover:text-sky-300 hover:underline">
                How our ML model evolved from Ridge to LightGBM
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* -- API skill / x402 -------------------------------------- */}
      <section className="border-t border-white/6 bg-zinc-900 py-10 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="h-px w-10 bg-linear-to-r from-violet-500 to-purple-500" />
          </div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
            Built for AI agents
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-zinc-400 md:mb-12 md:text-base">
            Two ways to give your AI access to live breakout signal data — no account required to get started.
          </p>

          <div className="mx-auto grid max-w-4xl min-w-0 gap-6 sm:grid-cols-2">

            <div className="min-w-0 rounded-2xl border-2 border-sky-500/40 bg-sky-950/35 p-6 shadow-[0_0_32px_-12px_rgba(56,189,248,0.25)] ring-1 ring-sky-500/20">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">x402 micropayments</h3>
                  <p className="text-xs font-medium text-sky-400">No registration needed</p>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-zinc-300">
                The{" "}
                <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-400 hover:text-sky-300 hover:underline">
                  x402 protocol
                </a>{" "}
                lets AI agents pay per call in USDC on Base — no account, no API key, no subscription. Just send the request and pay the 402.
              </p>

              <ul className="mb-5 space-y-2 text-sm text-zinc-400">
                {[
                  "From $0.005 per data call",
                  "USDC on Base (L2) — near-zero gas",
                  "Atomic: only charged on success",
                  "Works with any x402-compatible client",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border border-white/10 bg-black/50 px-4 py-3 font-mono text-xs text-zinc-300 wrap-anywhere">
                <span className="text-zinc-600"># Agent hits endpoint → gets 402 → pays → gets data</span>{"\n"}
                <span className="text-sky-400">curl</span> {absoluteUrl("/api/tickers/trending")}{"\n"}
                <span className="text-zinc-600">→ HTTP 402  payment-required: ey...</span>
              </div>

              <a
                href="/skill/SKILL.md"
                target="_blank"
                className="mt-4 inline-block w-full rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:from-sky-400 hover:to-blue-500 transition-colors touch-manipulation"
              >
                View API docs
              </a>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/4 p-6 ring-1 ring-white/5">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700 text-white ring-1 ring-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a.75.75 0 0 0-.878.68l-.005 3a.75.75 0 0 0 .75.75H6a.75.75 0 0 0 .75-.75v-.75h.75a.75.75 0 0 0 .75-.75v-.75h.75a.75.75 0 0 0 .53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1 0 15.75 1.5Zm0 3a.75.75 0 0 0 0 1.5A2.25 2.25 0 0 1 18 8.25a.75.75 0 0 0 1.5 0 3.75 3.75 0 0 0-3.75-3.75Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">API key + skill file</h3>
                  <p className="text-xs font-medium text-zinc-500">For registered users</p>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Register for full access including portfolio management, watchlists, and performance tracking. Connect any compatible LLM or agent client via the skill file.
              </p>

              <div className="mb-5 space-y-3">
                {[
                  { step: "1", label: "Register", desc: "Create a free account — no credit card needed." },
                  { step: "2", label: "Get API key", desc: "Generate a key from your Profile page in one click." },
                  { step: "3", label: "Install skill", desc: "Add the skill file to your LLM or agent client." },
                ].map(({ step, label, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white ring-1 ring-white/10">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-zinc-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="/skill/SKILL.md"
                  target="_blank"
                  className="inline-block w-full rounded-xl border border-white/20 bg-zinc-900/80 px-4 py-2.5 text-center text-sm font-semibold text-zinc-100 hover:border-white/30 hover:bg-zinc-800 transition-colors touch-manipulation"
                >
                  Download skill file
                </a>
                <p className="text-center text-xs text-zinc-600">
                  Full access: signals, portfolio, watchlist, performance
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* -- CTA Banner -------------------------------------------- */}
      <section className="relative overflow-hidden border-t border-white/6 bg-linear-to-br from-zinc-900 via-blue-950/90 to-zinc-950 py-12 md:py-20">
        {/* Depth layers */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/30" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sky-500/20 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="mb-3 text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
            Ready to find the next breakout?
          </h2>
          <p className="mb-4 text-sm text-zinc-400 md:text-base">
            Free to use. No credit card required.
          </p>
          <div className="mb-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 md:text-sm">
            {["Watchlist", "Portfolio tracking", "Full dashboard", "Weekly signal digest"].map((b) => (
              <span key={b} className="inline-flex items-center gap-1">
                <svg className="h-3 w-3 shrink-0 text-emerald-500/80 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                {b}
              </span>
            ))}
          </div>
          <Link
            href="/register"
            className="inline-block rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-900/50 ring-1 ring-sky-400/25 transition-all hover:from-sky-400 hover:to-blue-500 hover:shadow-sky-800/60 hover:ring-sky-400/40 touch-manipulation sm:text-base"
          >
            Create free account
          </Link>
        </div>
      </section>

      </main>

      {/* -- Footer ------------------------------------------------- */}
      <footer className="border-t border-white/10 bg-black py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <span className="text-sm font-bold text-white">
              Signal<span className="text-sky-400">Scope</span>
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
              <Link href="/blog" className="hover:text-zinc-300 transition-colors touch-manipulation">Blog</Link>
              <Link href="/faq" className="hover:text-zinc-300 transition-colors touch-manipulation">FAQ</Link>
              <Link href="/how-it-works" className="hover:text-zinc-300 transition-colors touch-manipulation">Methodology</Link>
              <Link href="/changelog" className="hover:text-zinc-300 transition-colors touch-manipulation">Changelog</Link>
              <Link href="/privacy" className="hover:text-zinc-300 transition-colors touch-manipulation">Privacy</Link>
              <a href="/skill/SKILL.md" target="_blank" className="hover:text-zinc-300 transition-colors touch-manipulation">API Docs</a>
              <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors touch-manipulation">x402 Protocol</a>
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-zinc-600 sm:text-left">
            Not financial advice. SignalScope is a research tool — always do your own due diligence before making investment decisions.
          </p>
          <p className="mt-2 text-center text-xs text-zinc-700 sm:text-left">
            &copy; {new Date().getFullYear()} SignalScope contributors. Released under the MIT License.
          </p>
        </div>
      </footer>

      {showGuestMobileBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/15 bg-zinc-950/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-md gap-2 px-4 pt-3">
            <Link
              href="/dashboard"
              className="flex-1 rounded-xl bg-linear-to-br from-sky-500 to-blue-600 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-sky-950/30 hover:from-sky-400 hover:to-blue-500 transition-colors touch-manipulation"
            >
              See live signals
            </Link>
            <Link
              href="/register"
              className="flex-1 rounded-xl border border-white/20 py-2.5 text-center text-sm font-semibold text-zinc-100 hover:border-white/30 hover:bg-white/5 transition-colors touch-manipulation"
            >
              Create account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
