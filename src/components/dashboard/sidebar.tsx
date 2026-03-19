"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { NextScanCountdown } from "@/components/dashboard/next-scan-countdown";
import { StatsWidget } from "@/components/dashboard/stats-widget";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { TickerSearch } from "@/components/dashboard/ticker-search";
const navItems = [
  { href: "/dashboard", label: "Signals", icon: "📡" },
  { href: "/trending", label: "Trending", icon: "📈" },
  { href: "/connections", label: "Connections", icon: "🔗" },
  { href: "/portfolio", label: "Portfolio", icon: "💼" },
  { href: "/performance", label: "Performance", icon: "🎯" },
  { href: "/methodology", label: "How It Works", icon: "ℹ️" },
  { href: "/changelog", label: "Changelog", icon: "📋" },
  { href: "/profile", label: "Profile", icon: "⚙️" },
];

export function Sidebar({ revision }: { revision: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
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

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <div className="flex min-w-0 flex-1 items-center">
          <button
            onClick={() => setOpen(true)}
            className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/dashboard" className="truncate text-lg font-bold text-gray-900 dark:text-zinc-100">
            SignalScope
          </Link>
        </div>
        <ThemeToggle />
      </div>

      {/* Backdrop overlay (mobile only) */}
      {open && (
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
            <Link href="/dashboard" className="text-xl font-bold text-gray-900 dark:text-zinc-100">
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
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
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
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                }`}
              >
                <span>🛡️</span>
                Admin
              </Link>
            )}
          </nav>

          <div className="border-t border-gray-200 px-4 py-3 dark:border-zinc-800">
            <StatsWidget revision={revision} />
          </div>

          <div className="border-t border-gray-200 px-4 py-3 dark:border-zinc-800">
            <NextScanCountdown />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 py-4 dark:border-zinc-800">
          {session?.user && (
            <div className="mb-2 truncate text-xs text-gray-500 dark:text-zinc-400">
              {session.user.email}
            </div>
          )}
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
        </div>
      </aside>
    </>
  );
}
