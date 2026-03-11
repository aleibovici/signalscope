import type { Metadata } from "next";
import Link from "next/link";
import { changelog } from "@/lib/changelog-data";

export const metadata: Metadata = {
  title: "Changelog — SignalScope",
  description:
    "What's new in SignalScope — improvements, new signal sources, ML updates, and bug fixes.",
  alternates: {
    canonical: "https://signalscopes.com/changelog",
  },
  openGraph: {
    url: "https://signalscopes.com/changelog",
    title: "Changelog — SignalScope",
    description:
      "What's new in SignalScope — improvements, new signal sources, ML updates, and bug fixes.",
  },
};

const categoryLabel: Record<string, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};

const categoryColor: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  improved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fixed: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-blue-800/30 bg-blue-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Signal<span className="text-blue-300">Scope</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Changelog</h1>
          <p className="mt-2 text-gray-500">
            What&apos;s new — improvements, new signal sources, ML updates, and fixes.
          </p>
        </div>

        <div className="space-y-10">
          {changelog.map((entry) => (
            <article
              key={entry.date}
              className="relative border-l-2 border-blue-200 pl-6"
            >
              {/* Timeline dot */}
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white" />

              <time
                dateTime={entry.date}
                className="block text-xs font-semibold uppercase tracking-widest text-blue-600"
              >
                {formatDate(entry.date)}
              </time>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                {entry.title}
              </h2>

              <div className="mt-4 space-y-4">
                {entry.changes.map((group) => (
                  <div key={group.category}>
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${categoryColor[group.category]}`}
                    >
                      {categoryLabel[group.category]}
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} SignalScope. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
