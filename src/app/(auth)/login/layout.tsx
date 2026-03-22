import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your SignalScope dashboard — view live AI-scored breakout signals, manage your portfolio, and track signal performance.",
  alternates: {
    canonical: "https://signalscopes.com/login",
  },
  openGraph: {
    url: "https://signalscopes.com/login",
    title: "Login — SignalScope",
    description: "Sign in to your SignalScope dashboard — view live AI-scored breakout signals, manage your portfolio, and track signal performance.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalScope — Stock Breakout Signal Detection",
      },
    ],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
