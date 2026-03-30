import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginPage from "./(auth)/login/page";

export const metadata: Metadata = {
  title: "SignalScope — Stock Breakout Signal Detection",
  description:
    "Find breakout stock candidates before market consensus. SignalScope monitors Reddit, X/Twitter, SEC insider filings, and volume spikes — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis, ML backtesting, and an AI Agent Skill. Pay-per-call API access via x402 micropayments — no account required.",
  alternates: {
    canonical: "https://signalscopes.com",
  },
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return <LoginPage />;
}
