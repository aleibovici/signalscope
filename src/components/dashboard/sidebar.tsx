"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { NextScanCountdown } from "@/components/dashboard/next-scan-countdown";
import { StatsWidget } from "@/components/dashboard/stats-widget";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { TickerSearch } from "@/components/dashboard/ticker-search";
import { useShareReward } from "@/hooks/use-share-reward";
import { ShareRewardBadge } from "@/components/dashboard/share-reward-badge";
const NavIcons = {
  Signals: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.636 18.364a9 9 0 010-12.728M18.364 5.636a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072M12 13a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  ),
  Trending: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Performance: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  PaperTrading: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  HowItWorks: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Changelog: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  Portfolio: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  ApiAccess: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  Profile: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  Admin: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

const publicNavItems: { href: string; label: string; icon: React.ReactNode; tourId: string; matchPrefix?: string }[] = [
  { href: "/dashboard", label: "Daily Signals", icon: NavIcons.Signals, tourId: "tour-signals" },
  { href: "/trending", label: "Trending", icon: NavIcons.Trending, tourId: "tour-trending" },
  { href: "/results/signal-quality", label: "Results", icon: NavIcons.Performance, tourId: "tour-results", matchPrefix: "/results" },
];
const authNavItems = [
  { href: "/portfolio", label: "Portfolio", icon: NavIcons.Portfolio },
  { href: "/subscription", label: "API Access", icon: NavIcons.ApiAccess },
  { href: "/profile", label: "Profile", icon: NavIcons.Profile },
];

export function Sidebar({ revision }: { revision: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: shareReward } = useShareReward(!!session?.user);
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Tour control: open/close sidebar from the tour component on mobile
  const [tourActive, setTourActive] = useState(false);
  useEffect(() => {
    const onOpen = () => { setOpen(true); setTourActive(true); };
    const onClose = () => { setOpen(false); setTourActive(false); };
    window.addEventListener("tour:open-sidebar", onOpen);
    window.addEventListener("tour:close-sidebar", onClose);
    return () => {
      window.removeEventListener("tour:open-sidebar", onOpen);
      window.removeEventListener("tour:close-sidebar", onClose);
    };
  }, []);

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <div className="flex min-w-0 flex-1 items-center">
          <button
            onClick={() => setOpen(true)}
            className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/login" className="truncate text-lg font-bold text-gray-900 dark:text-zinc-100">
            SignalScope
          </Link>
        </div>
        <ThemeToggle />
      </div>

      {/* Backdrop overlay (mobile only) — suppressed when tour is controlling the sidebar */}
      {open && !tourActive && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onPointerDown={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 md:static md:z-auto md:translate-x-0 md:bg-gray-50 md:dark:bg-zinc-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-5 dark:border-zinc-800 md:px-6">
          <div className="min-w-0">
            <Link href="/login" className="text-xl font-bold text-gray-900 dark:text-zinc-100">
              SignalScope
            </Link>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Breakout Detection</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 md:hidden"
              aria-label="Close menu"
            >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
          </div>
        </div>

        <TickerSearch />

        <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1 px-3 py-4">
            {publicNavItems.map((item) => {
              const isActive = item.matchPrefix
                ? pathname.startsWith(item.matchPrefix)
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id={item.tourId}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500 pl-[10px] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
                      : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent pl-[10px] dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
            {session?.user && authNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500 pl-[10px] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
                      : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent pl-[10px] dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
            {session?.user?.role === "admin" && (
              <Link
                href="/admin"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/admin"
                    ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500 pl-[10px] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
                    : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent pl-[10px] dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                }`}
              >
                {NavIcons.Admin}
                Admin
              </Link>
            )}
          </nav>

          {(!session?.user || !shareReward?.claimed) && (
            <div className="border-t border-gray-200 px-4 py-3 dark:border-zinc-800">
              <ShareRewardBadge guest={!session?.user} hasPro={shareReward?.hasActiveSubscription ?? false} />
            </div>
          )}

          <div className="border-t border-gray-200 px-4 py-3 dark:border-zinc-800">
            <StatsWidget revision={revision} />
          </div>

          <div className="border-t border-gray-200 px-4 py-3 dark:border-zinc-800">
            <NextScanCountdown />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 py-2 dark:border-zinc-800">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[
              { href: "/blog", label: "Blog" },
              { href: "/faq", label: "FAQ" },
              { href: "/changelog", label: "Changelog" },
              { href: "/how-it-works", label: "How it works" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 py-4 dark:border-zinc-800">
          {session?.user ? (
            <>
              <div className="mb-2 truncate text-xs text-gray-500 dark:text-zinc-400">
                {session.user.email}
              </div>
              <Link
                href="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                What is SignalScope?
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fetch("/api/auth/csrf")
                    .then((res) => res.json())
                    .then(({ csrfToken }) =>
                      fetch("/api/auth/signout", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({ csrfToken }),
                      })
                    )
                    .finally(() => {
                      window.location.href = "/login";
                    });
                }}
                className="w-full cursor-pointer touch-manipulation rounded-md px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                className="block w-full rounded-md bg-blue-600 px-3 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="block w-full rounded-md border border-gray-300 px-3 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 pt-1 text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                What is SignalScope?
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
