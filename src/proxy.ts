import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Exact page paths (no sub-routes)
const publicPages = new Set(["/login", "/register", "/changelog", "/api/stats/performance"]);

// API prefixes — matched with a boundary check so /api/scans matches
// /api/scans and /api/scans/abc but NOT /api/scans-admin
const publicApiPrefixes = [
  "/api/auth",
  "/api/health",
  "/api/alerts",
  "/api/harvest",
  "/api/snapshots",
  "/api/reports",
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml|ico|md)$).*)",
  ],
};
