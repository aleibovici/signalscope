import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Ticker Connections",
  description:
    "Interactive network graph showing co-occurrence relationships between stock tickers. Discover sector clusters, correlated breakout candidates, and Jaccard similarity scores.",
  alternates: { canonical: absoluteUrl("/connections") },
  openGraph: {
    url: absoluteUrl("/connections"),
    title: "Ticker Connections — SignalScope",
    description:
      "Network graph of co-occurring stock tickers. Discover which stocks appear together across signal sources and find correlated breakout candidates.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
