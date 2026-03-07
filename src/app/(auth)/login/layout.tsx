import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to SignalScope — spot breakout stocks before the crowd with AI-powered signal detection, cross-scan trending, and ML backtesting.",
  alternates: {
    canonical: "http://localhost:3000/login",
  },
  openGraph: {
    url: "http://localhost:3000/login",
    title: "Login — SignalScope",
    description: "Sign in to SignalScope — spot breakout stocks before the crowd with AI-powered signal detection, cross-scan trending, and ML backtesting.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
