"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NextScanCountdown } from "@/components/dashboard/next-scan-countdown";

const navItems = [
  { href: "/dashboard", label: "Signals", icon: "📡" },
  { href: "/portfolio", label: "Portfolio", icon: "💼" },
  { href: "/history", label: "Scan History", icon: "📊" },
  { href: "/filtered", label: "Filtered (P&D)", icon: "🚫" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
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
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Link href="/dashboard" className="text-lg font-bold text-gray-900">
          SignalScope
        </Link>
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 md:bg-gray-50 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
              SignalScope
            </Link>
            <p className="mt-1 text-xs text-gray-500">Breakout Detection</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:hidden"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          <NextScanCountdown />
        </div>

        <div className="border-t border-gray-200 px-4 py-4">
          {session?.user && (
            <div className="mb-2 truncate text-xs text-gray-500">
              {session.user.email}
            </div>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              signOut({ callbackUrl: "/login" });
            }}
            className="w-full cursor-pointer touch-manipulation rounded-md px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
