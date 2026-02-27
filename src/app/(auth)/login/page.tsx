"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
    <div className="w-full max-w-5xl overflow-hidden rounded-2xl shadow-xl">
      <div className="flex flex-col lg:flex-row">
        {/* Left — marketing panel */}
        <div className="flex flex-col justify-between bg-blue-700 px-8 py-10 lg:w-[55%] lg:px-12 lg:py-14">
          <div>
            <div className="mb-8">
              <span className="text-2xl font-bold tracking-tight text-white">
                Signal<span className="text-blue-300">Scope</span>
              </span>
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight text-white lg:text-4xl">
              Spot breakout stocks before the crowd
            </h1>
            <p className="mb-10 text-base leading-relaxed text-blue-100">
              SignalScope continuously harvests signals from Reddit, X/Twitter,
              SEC insider filings, and volume data — then uses AI to score,
              validate, and surface the tickers most likely to break out.
            </p>

            <ul className="space-y-4">
              {[
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13-0.87.5M4.21 15.5l-.87.5M20.66 15.5l-.87-.5M4.21 8.5l-.87-.5M21 12h-1M4 12H3" />
                  ),
                  title: "Multi-source signal harvesting",
                  desc: "Reddit, X/Twitter, SEC insider filings, and unusual volume — all in one place.",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  ),
                  title: "AI scoring & validation",
                  desc: "GPT-4o and Claude score every signal and filter pump-and-dump candidates automatically.",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  ),
                  title: "Portfolio tracking",
                  desc: "Track your positions against signals and see how breakout calls perform over time.",
                },
              ].map(({ icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 rounded-lg bg-blue-600 p-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4 text-blue-200">
                      {icon}
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-sm text-blue-200">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 text-xs text-blue-300">
            Not financial advice. Do your own research.
          </p>
        </div>

        {/* Right — sign-in form */}
        <div className="flex flex-col justify-center bg-white px-8 py-10 lg:w-[45%] lg:px-10 lg:py-14">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Sign in</h2>
          <p className="mb-8 text-sm text-gray-500">Welcome back</p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
