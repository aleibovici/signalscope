import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free SignalScope account — AI-scored breakout signals from 7 sources, pump-and-dump filtering, portfolio tracking, and ML-driven performance insights.",
  alternates: {
    canonical: "http://localhost:3000/register",
  },
  openGraph: {
    url: "http://localhost:3000/register",
    title: "Sign Up — SignalScope",
    description: "Create a free SignalScope account — AI-scored breakout signals from 7 sources, pump-and-dump filtering, portfolio tracking, and ML-driven performance insights.",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
