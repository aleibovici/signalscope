import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Exact page paths (no sub-routes)
const publicPages = new Set(["/", "/login", "/register", "/pricing", "/changelog", "/privacy", "/faq", "/how-it-works", "/forgot-password", "/reset-password", "/api/stats/performance", "/api/search", "/api/methodology", "/api/changelog", "/api/votes", "/opengraph-image", "/dashboard", "/trending", "/connections", "/performance", "/methodology", "/results", "/results/paper-trading", "/results/signal-quality"]);

// API prefixes — matched with a boundary check so /api/scans matches
// /api/scans and /api/scans/abc but NOT /api/scans-admin
const publicApiPrefixes = [
  "/api/auth",
  "/api/health",
  "/api/alerts",
  "/api/harvest",
  "/api/snapshots",
  "/api/reports",
  "/api/tweets",
  "/api/twitter",
  "/api/linkedin",
  "/api/stripe/webhook",
  "/api/brokers",
  "/api/scans",
  "/api/signals",
  "/api/stats",
  "/api/prices",
  "/api/performance",
  "/api/paper-trading",
];

// Public page prefixes (pages with sub-routes like /blog/[slug])
const publicPagePrefixes = ["/blog", "/ticker"];

// x402-monetized paths — bypass middleware auth so the route handler
// can return 402 payment details or validate x-payment proofs.
export function isX402Path(pathname: string): boolean {
  return pathname === "/api/tickers" || pathname.startsWith("/api/tickers/");
}

export function isPublicPath(pathname: string): boolean {
  if (publicPages.has(pathname)) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  if (publicPagePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return publicApiPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // Redirect www → non-www to consolidate SEO signals
  if (host.startsWith("www.")) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, "");
    return Response.redirect(url.toString(), 301);
  }

  if (isPublicPath(pathname)) return;
  if (isX402Path(pathname)) return;

  // Let mobile Bearer token and API key requests through — real verification
  // happens in getCurrentUserId() inside route handlers
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return;
  if (req.headers.get("x-api-key")) return;

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }

  // Admin-only routes — require role === "admin"
  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/");
  if (isAdminRoute && req.auth.user?.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml|ico|md|webmanifest)$).*)",
  ],
};
