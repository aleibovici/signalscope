import { NextResponse } from "next/server";

const BASE = "https://signalscopes.com";

export function GET() {
  const body = {
    linkset: [
      {
        anchor: `${BASE}/api/search`,
        "service-doc": [
          { href: `${BASE}/skill/api-public.md`, type: "text/markdown" },
        ],
        status: [
          { href: `${BASE}/api/health`, type: "application/json" },
        ],
      },
      {
        anchor: `${BASE}/api/methodology`,
        "service-doc": [
          { href: `${BASE}/skill/api-public.md`, type: "text/markdown" },
        ],
      },
      {
        anchor: `${BASE}/api/stats`,
        "service-doc": [
          { href: `${BASE}/skill/api-public.md`, type: "text/markdown" },
        ],
      },
      {
        anchor: `${BASE}/api/tickers/trending`,
        "service-doc": [
          { href: `${BASE}/skill/api-public.md`, type: "text/markdown" },
        ],
      },
      {
        anchor: `${BASE}/api/tickers`,
        "service-doc": [
          { href: `${BASE}/skill/api-authenticated.md`, type: "text/markdown" },
        ],
      },
      {
        anchor: `${BASE}/api/portfolio`,
        "service-doc": [
          { href: `${BASE}/skill/api-authenticated.md`, type: "text/markdown" },
        ],
      },
      {
        anchor: `${BASE}/api/watchlist`,
        "service-doc": [
          { href: `${BASE}/skill/api-authenticated.md`, type: "text/markdown" },
        ],
      },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "content-type": "application/linkset+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
