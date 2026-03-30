import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free SignalScope account — AI-scored breakout signals from 8 sources, pump-and-dump filtering, XGBoost ML backtesting, and portfolio tracking.",
  alternates: {
    canonical: "http://localhost:3000/register",
  },
  openGraph: {
    url: "http://localhost:3000/register",
    title: "Sign Up — SignalScope",
    description: "Create a free SignalScope account — AI-scored breakout signals from 8 sources, pump-and-dump filtering, XGBoost ML backtesting, and portfolio tracking.",
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
    title: "Sign Up — SignalScope",
    description: "Create a free SignalScope account — AI-scored breakout signals from 8 sources, pump-and-dump filtering, XGBoost ML backtesting, and portfolio tracking.",
    images: ["/opengraph-image"],
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
