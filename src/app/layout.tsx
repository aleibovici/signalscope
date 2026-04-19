import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { QueryProvider } from "@/lib/query-provider";
import { AppThemeProvider } from "@/lib/theme-provider";
import { AuthSessionProvider } from "@/lib/session-provider";
import { GoogleAnalyticsPageView } from "@/lib/google-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://signalscopes.com"),
  title: {
    default: "SignalScope — Stock Breakout Signal Detection",
    template: "%s — SignalScope",
  },
  description: "Find breakout stock candidates before market consensus. SignalScope monitors Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, volume spikes, and Polymarket — scored by AI, filtered for pump-and-dumps, with cross-scan trending, LightGBM backtesting, and an AI Agent Skill. Pay-per-call API access via x402 micropayments — no account required.",
  keywords: [
    "stock breakout",
    "stock signals",
    "breakout detection",
    "stock alerts",
    "stock screening",
    "pump and dump filter",
    "SEC insider trading",
    "volume spike stocks",
    "options flow signals",
    "net premium flow",
    "AI stock analysis",
    "stock market signals",
    "machine learning stocks",
    "XGBoost stock prediction",
    "stock backtesting",
    "trending stocks",
    "cross-scan momentum",
    "stock API",
    "AI agent skill",
    "AI stock assistant",
    "x402",
    "stock API micropayments",
    "USDC stock data",
  ],
  authors: [{ name: "SignalScope" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://signalscopes.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://signalscopes.com",
    siteName: "SignalScope",
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, options flow with net premium tracking, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill. x402 pay-per-call API access, no account required.",
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
    site: "@signalscopes",
    creator: "@signalscopes",
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, options flow with net premium tracking, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill. x402 pay-per-call API access, no account required.",
    images: ["/opengraph-image"],
  },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION && {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    }),
    ...(process.env.BING_SITE_VERIFICATION && {
      other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION },
    }),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SignalScope",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://signalscopes.com/#organization",
      "name": "SignalScope",
      "url": "https://signalscopes.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://signalscopes.com/apple-touch-icon.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://signalscopes.com/#website",
      "url": "https://signalscopes.com",
      "name": "SignalScope",
      "description": "Stock breakout signal detection platform",
      "publisher": { "@id": "https://signalscopes.com/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://signalscopes.com/api/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://signalscopes.com/#app",
      "name": "SignalScope",
      "url": "https://signalscopes.com",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "description":
        "Find breakout stock candidates before market consensus. SignalScope monitors public market signals from Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow with net premium tracking, volume spikes, and Polymarket prediction markets — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis, LightGBM backtesting, an AI Agent Skill, and x402 pay-per-call API access.",
      "offers": [
        {
          "@type": "Offer",
          "name": "Free",
          "price": "0",
          "priceCurrency": "USD",
          "url": "https://signalscopes.com/register",
        },
        {
          "@type": "Offer",
          "name": "Pro Monthly",
          "price": "10",
          "priceCurrency": "USD",
          "url": "https://signalscopes.com/pricing",
        },
        {
          "@type": "Offer",
          "name": "Pro Yearly",
          "price": "100",
          "priceCurrency": "USD",
          "url": "https://signalscopes.com/pricing",
        },
      ],
      "publisher": { "@id": "https://signalscopes.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="SignalScope Blog"
          href="https://signalscopes.com/blog/feed.xml"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-M2CSNXL7');`}
        </Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M2CSNXL7"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Suspense fallback={null}>
          <GoogleAnalyticsPageView />
        </Suspense>
        <a
          href="#main-scroll"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow dark:focus:bg-zinc-900 dark:focus:text-zinc-100"
        >
          Skip to main content
        </a>
        <AppThemeProvider>
          <AuthSessionProvider>
            <QueryProvider>{children}</QueryProvider>
          </AuthSessionProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
