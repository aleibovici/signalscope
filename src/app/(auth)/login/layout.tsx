import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your SignalScope dashboard — view live AI-scored breakout signals, manage your portfolio, and track signal performance.",
  alternates: {
    canonical: "http://localhost:3000/login",
  },
  openGraph: {
    url: "http://localhost:3000/login",
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalScope — Stock Breakout Signal Detection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes.",
    images: ["/opengraph-image"],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
