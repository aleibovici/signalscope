"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/results/signal-quality", label: "Signal Quality" },
  { href: "/results/simulated-portfolio", label: "Paper Trading" },
];

export function ResultsTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6" aria-label="Results tabs">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
