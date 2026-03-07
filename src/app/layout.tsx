import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { QueryProvider } from "@/lib/query-provider";
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://signalscopes.com"),
  title: {
    default: "SignalScope — Stock Breakout Signal Detection",
    template: "%s — SignalScope",
  },
  description: "Find breakout stock candidates before market consensus. SignalScope monitors Reddit, X/Twitter, SEC insider filings, and volume spikes — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis and ML backtesting.",
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
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending and ML backtesting.",
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
    title: "SignalScope — Stock Breakout Signal Detection",
    description: "Find breakout stock candidates before market consensus. AI-scored signals from Reddit, X/Twitter, SEC filings, and volume spikes — with cross-scan trending and ML backtesting.",
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
          "urlTemplate": "https://signalscopes.com/ticker/{search_term_string}",
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
        "Find breakout stock candidates before market consensus. SignalScope monitors public market signals from Reddit, X/Twitter, SEC insider filings, and volume spikes — scored by AI, filtered for pump-and-dumps, with cross-scan trending analysis and ML backtesting.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
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
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
        <Suspense fallback={null}>
          <GoogleAnalyticsPageView />
        </Suspense>
        <AuthSessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
