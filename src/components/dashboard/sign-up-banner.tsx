"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";

export function SignUpBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 pr-10 text-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:pr-12">
      <p className="font-semibold text-blue-800 dark:text-blue-200">
        You&apos;re browsing as a guest.
      </p>
      <p className="mt-1 text-xs text-blue-800/90 dark:text-blue-200/85 sm:text-sm">
        Free account unlocks watchlist, portfolio, weekly digest, and the full dashboard — no credit card needed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ButtonLink href="/register" variant="primary" size="sm">
          Sign up free
        </ButtonLink>
        <ButtonLink href="/login" variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          Sign in
        </ButtonLink>
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
