import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginPage from "./(auth)/login/page";
import { HeroTrendingPreview } from "@/components/hero-trending-preview";

export const metadata: Metadata = {
  title: "SignalScope — Stock Breakout Signal Detection",
  description:
    "Find breakout stock candidates before market consensus. SignalScope monitors Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, volume spikes, and Polymarket — scored by AI, filtered for pump-and-dumps, with LightGBM backtesting and an AI Agent Skill. Pay-per-call API access via x402 micropayments — no account required.",
  alternates: {
    canonical: "https://signalscopes.com",
  },
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return <LoginPage heroPreview={<HeroTrendingPreview />} />;
}
