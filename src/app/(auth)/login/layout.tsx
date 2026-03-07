import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to SignalScope — spot breakout stocks before the crowd with AI-powered signal detection, cross-scan trending, ML backtesting, and an AI Agent Skill.",
  alternates: {
    canonical: "https://signalscopes.com/login",
  },
  openGraph: {
    url: "https://signalscopes.com/login",
    title: "Login — SignalScope",
    description: "Sign in to SignalScope — spot breakout stocks before the crowd with AI-powered signal detection, cross-scan trending, ML backtesting, and an AI Agent Skill.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
