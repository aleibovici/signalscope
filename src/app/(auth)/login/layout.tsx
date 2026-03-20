import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your SignalScope dashboard — view live AI-scored breakout signals, manage your portfolio, and track signal performance.",
  alternates: {
    canonical: "http://localhost:3000/login",
  },
  openGraph: {
    url: "http://localhost:3000/login",
    title: "Login — SignalScope",
    description: "Sign in to your SignalScope dashboard — view live AI-scored breakout signals, manage your portfolio, and track signal performance.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
