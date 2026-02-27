"use client";

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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-6 py-5">
        <Link href="/dashboard" className="text-xl font-bold text-gray-900">
          SignalScope
        </Link>
        <p className="mt-1 text-xs text-gray-500">Breakout Detection</p>
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
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
