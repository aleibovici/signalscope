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
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "SignalScope — Stock Breakout Signal Detection",
    template: "%s — SignalScope",
  },
  description: "Find breakout stock candidates before market consensus. SignalScope monitors Reddit, X/Twitter, SEC insider filings, and volume spikes — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis, ML backtesting, and an AI Agent Skill. Pay-per-call API access via x402 micropayments — no account required.",
  keywords: [
    "stock breakout",
    "stock signals",
    "breakout detection",
    "stock alerts",
    "stock screening",
    "pump and dump filter",
    "SEC insider trading",
    "volume spike stocks",
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
    canonical: "http://localhost:3000",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "http://localhost:3000",
    siteName: "SignalScope",
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill. x402 pay-per-call API access, no account required.",
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
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending, ML backtesting, and an AI Agent Skill. x402 pay-per-call API access, no account required.",
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
  formatDetection: {
    telephone: false,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "http://localhost:3000/#organization",
      "name": "SignalScope",
      "url": "http://localhost:3000",
      "logo": {
        "@type": "ImageObject",
        "url": "http://localhost:3000/apple-touch-icon.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "http://localhost:3000/#website",
      "url": "http://localhost:3000",
      "name": "SignalScope",
      "description": "Stock breakout signal detection platform",
      "publisher": { "@id": "http://localhost:3000/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "http://localhost:3000/api/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "http://localhost:3000/#app",
      "name": "SignalScope",
      "url": "http://localhost:3000",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "description":
        "Find breakout stock candidates before market consensus. SignalScope monitors public market signals from Reddit, X/Twitter, SEC insider filings, congressional trades, options flow, and volume spikes — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis, ML backtesting, an AI Agent Skill, and x402 pay-per-call API access.",
      "offers": {
        "@type": "AggregateOffer",
        "lowPrice": "0",
        "highPrice": "100",
        "priceCurrency": "USD",
        "offerCount": "2",
      },
      "publisher": { "@id": "http://localhost:3000/#organization" },
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
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="SignalScope Blog"
          href="http://localhost:3000/blog/feed.xml"
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TFSF1MJ97V"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TFSF1MJ97V');
          `}
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
