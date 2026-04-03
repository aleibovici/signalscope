import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trending Tickers",
  description:
    "Cross-scan trending stock tickers ranked by signal momentum, appearance frequency, and AI score. See which stocks are building consensus across multiple harvest runs.",
  alternates: { canonical: "https://signalscopes.com/trending" },
  openGraph: {
    url: "https://signalscopes.com/trending",
    title: "Trending Tickers — SignalScope",
    description:
      "Cross-scan trending stocks ranked by momentum and AI score. Spot recurring breakout candidates building consensus across multiple scans.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
