import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signal Performance",
  description:
    "Historical performance tracking for SignalScope's AI-scored breakout signals. View 1d, 3d, 7d, and 30d returns across Emerging, Building, and Consensus stages.",
  alternates: { canonical: "http://localhost:3000/performance" },
  openGraph: {
    url: "http://localhost:3000/performance",
    title: "Signal Performance — SignalScope",
    description:
      "Track how SignalScope's AI-scored breakout signals perform over time. 1d through 30d return data by stage and score range.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
