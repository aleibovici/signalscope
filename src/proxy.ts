import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Exact page paths (no sub-routes)
const publicPages = new Set(["/login", "/register"]);

// API prefixes — matched with a boundary check so /api/scans matches
// /api/scans and /api/scans/abc but NOT /api/scans-admin
const publicApiPrefixes = [
  "/api/auth",
  "/api/scans",
  "/api/signals",
  "/api/tickers",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  if (publicPages.has(pathname)) return true;
  return publicApiPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return;

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml|ico)$).*)",
  ],
};
