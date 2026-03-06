import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a SignalScope account — get AI-scored stock breakout signals from Reddit, X/Twitter, SEC insider filings, and volume spikes, refined by ML backtesting.",
  alternates: {
    canonical: "http://localhost:3000/register",
  },
  openGraph: {
    url: "http://localhost:3000/register",
    title: "Sign Up — SignalScope",
    description: "Create a SignalScope account — get AI-scored stock breakout signals from Reddit, X/Twitter, SEC insider filings, and volume spikes, refined by ML backtesting.",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
