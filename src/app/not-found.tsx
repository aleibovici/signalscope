import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist. Return to the SignalScope dashboard to find breakout stock signals.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="max-w-md">
        <p className="text-5xl font-bold text-blue-600">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
          <Link href="/blog" className="hover:text-blue-600 transition-colors">Blog</Link>
          <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link>
          <Link href="/how-it-works" className="hover:text-blue-600 transition-colors">Methodology</Link>
          <Link href="/changelog" className="hover:text-blue-600 transition-colors">Changelog</Link>
        </div>
      </div>
    </div>
  );
}
