"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix?: string;
  authOnly?: boolean;
};

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Signals",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.636 18.364a9 9 0 010-12.728M18.364 5.636a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072M12 13a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
  },
  {
    href: "/trending",
    label: "Trending",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href: "/results/signal-quality",
    matchPrefix: "/results",
    label: "Results",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
    authOnly: true,
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((t) => !t.authOnly || session?.user);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch justify-around border-t border-border-default bg-surface-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {visibleTabs.map((tab) => {
        const active = tab.matchPrefix
          ? pathname.startsWith(tab.matchPrefix)
          : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors ${
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted hover:text-secondary"
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            <span className="truncate text-[10px] font-medium tracking-wide">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
