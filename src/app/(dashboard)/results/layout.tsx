import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Results",
  description:
    "SignalScope paper trading results and signal performance. Live Alpaca account equity, trade win rates, weekly cohort breakdowns, and SPY-benchmarked returns.",
  alternates: { canonical: "https://signalscopes.com/results/paper-trading" },
  openGraph: {
    url: "https://signalscopes.com/results/paper-trading",
    title: "Results — SignalScope",
    description:
      "Live paper trading results and signal quality metrics. Actual order fills, equity curve, win rates, and weekly cohort performance.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
