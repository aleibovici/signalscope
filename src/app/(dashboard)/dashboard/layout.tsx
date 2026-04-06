import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Signals",
  description:
    "Real-time AI-scored stock breakout signals from Reddit, X/Twitter, SEC insider filings, congressional trades, options flow with net premium tracking, and volume spikes. Filter by stage: Emerging, Building, or Consensus.",
  alternates: { canonical: "http://localhost:3000/dashboard" },
  openGraph: {
    url: "http://localhost:3000/dashboard",
    title: "Live Signals — SignalScope",
    description:
      "Real-time AI-scored stock breakout signals from 8 sources including options flow with net premium tracking. Filter by stage, track your watchlist, and spot breakouts before market consensus.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function DashboardPageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
