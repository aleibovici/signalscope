"use client";

import Link from "next/link";

interface ShareRewardBadgeProps {
  /** If true, links to /register; if false, links to /profile#share-reward */
  guest?: boolean;
  /** If true, user already has Pro — copy reflects credit, not unlocking */
  hasPro?: boolean;
}

export function ShareRewardBadge({ guest = false, hasPro = false }: ShareRewardBadgeProps) {
  const subtext = guest
    ? "Sign up & tweet about us"
    : hasPro
      ? "Tweet about us, get 1 month free"
      : "Tweet about us to unlock Pro";

  return (
    <Link
      href={guest ? "/register" : "/profile#share-reward"}
      className="block rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-gray-900 dark:hover:bg-zinc-200"
    >
      <span className="font-semibold">Get 1 month Pro free</span>
      <br />
      {subtext} &rarr;
    </Link>
  );
}
