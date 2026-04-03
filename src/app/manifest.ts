import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SignalScope — Stock Breakout Signal Detection",
    short_name: "SignalScope",
    description:
      "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    orientation: "portrait",
    categories: ["finance", "utilities"],
    icons: [
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
