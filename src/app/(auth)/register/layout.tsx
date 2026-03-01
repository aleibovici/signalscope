import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a SignalScope account — get AI-scored stock breakout signals from Reddit, X/Twitter, SEC insider filings, and volume spikes.",
  alternates: {
    canonical: "https://signalscopes.com/register",
  },
  openGraph: {
    url: "https://signalscopes.com/register",
    title: "Sign Up — SignalScope",
    description: "Create a SignalScope account — get AI-scored stock breakout signals from Reddit, X/Twitter, SEC insider filings, and volume spikes.",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
