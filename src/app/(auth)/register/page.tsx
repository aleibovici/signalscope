"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Account created but sign-in failed. Please log in manually.");
      setLoading(false);
    } else {
      await trackConversion("sign_up", { method: "credentials" });
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <nav
        className="fixed top-0 z-50 w-full border-b border-zinc-700/50 bg-zinc-950/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/login" className="text-xl font-bold tracking-tight text-white touch-manipulation">
            Signal<span className="text-sky-400">Scope</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/15 transition-colors touch-manipulation"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-zinc-950 via-zinc-950 to-blue-950/40" />
      <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-500/6 blur-3xl" />

      <div className="relative flex min-h-screen items-center justify-center px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
        <div className="w-full max-w-md rounded-2xl border border-zinc-600/40 bg-zinc-900/55 p-8 shadow-[0_0_48px_-12px_rgba(56,189,248,0.2)] backdrop-blur-xl ring-1 ring-white/5 sm:p-8">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Account</p>
          <h1 className="mb-1 text-2xl font-bold text-white">Create account</h1>
          <p className="mb-4 text-sm text-zinc-400">
            Free — no credit card required.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-x-3 gap-y-2 text-xs text-zinc-500 sm:grid-cols-2">
            {[
              ["Watchlist", "Save and track tickers"],
              ["Portfolio", "Log and measure picks"],
              ["Dashboard", "Trending, connections, history"],
              ["Weekly digest", "Top signals every Sunday"],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-start gap-1.5">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/80" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                <span>
                  <span className="font-medium text-zinc-300">{label}</span> — {desc}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-300">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-600/50 bg-zinc-950/50 px-3 py-2.5 text-sm text-white placeholder-zinc-500 shadow-inner focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-600/50 bg-zinc-950/50 px-3 py-2.5 text-sm text-white placeholder-zinc-500 shadow-inner focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-linear-to-br from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 transition-colors touch-manipulation"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-white hover:text-sky-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
