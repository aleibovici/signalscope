import type { Metadata } from "next";
import { ResultsTabs } from "./tabs";

export const metadata: Metadata = {
  title: "Results",
  description:
    "Track SignalScope's signal quality and simulated portfolio performance. Historical win rates, cohort breakdowns, and paper trading returns vs S&P 500.",
  alternates: { canonical: "http://localhost:3000/results/signal-quality" },
  openGraph: {
    url: "http://localhost:3000/results/signal-quality",
    title: "Results — SignalScope",
    description:
      "Signal quality metrics and simulated portfolio returns. 1d through 30d win rates, weekly cohorts, and SPY-benchmarked paper trades.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <ResultsTabs>{children}</ResultsTabs>;
}
