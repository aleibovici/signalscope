"use client";

import { useState } from "react";
import Link from "next/link";

export function SignUpBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 pr-10 text-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:pr-12">
      <p className="text-blue-800 dark:text-blue-200">
        <span className="font-semibold">You&apos;re browsing as a guest.</span>{" "}
        <span className="text-blue-800/90 dark:text-blue-200/90">
          Create a free account — no credit card — and your watchlist, portfolio, and preferences sync everywhere you sign in.
        </span>
      </p>
      <ul className="mt-2.5 space-y-1.5 text-xs text-blue-800 dark:text-blue-200 sm:text-sm">
        <li className="flex gap-2">
          <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">Watchlist</span>
          <span className="text-blue-800/90 dark:text-blue-200/85">
            Bookmark tickers and jump back to live mentions, sources, and stages in one place.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">Portfolio</span>
          <span className="text-blue-800/90 dark:text-blue-200/85">
            Log positions and track how your picks perform over time with the same return analytics as the platform.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">Full dashboard</span>
          <span className="text-blue-800/90 dark:text-blue-200/85">
            Trending names, co-occurrence network, ticker history, and methodology — tied to your account.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">Weekly digest</span>
          <span className="text-blue-800/90 dark:text-blue-200/85">
            Free weekly email with the top signals and recent winners — delivered every Sunday.
          </span>
        </li>
      </ul>
      <p className="mt-2.5 text-xs text-blue-800/85 dark:text-blue-200/80 sm:text-sm">
        <span className="font-semibold text-blue-800 dark:text-blue-200">Plus:</span> tweet about us after signing up and get 1 month of Pro free.
      </p>
      <p className="mt-1.5 text-xs text-blue-800/85 dark:text-blue-200/80 sm:text-sm">
        <span className="font-semibold text-blue-800 dark:text-blue-200">Pro</span> (paid) unlocks{" "}
        <Link
          href="/subscription"
          className="font-medium text-blue-700 underline decoration-blue-400/60 underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          API access
        </Link>
        , on-demand AI reports with trade setups, and email alerts for new signals.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href="/register"
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Sign up free
        </Link>
        <Link
          href="/login"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Sign in
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 shrink-0 rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 dark:text-blue-500 dark:hover:bg-blue-900/50 dark:hover:text-blue-300 sm:right-3 sm:top-3"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}
