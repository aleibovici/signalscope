import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/blog", "/blog/feed.xml", "/faq", "/how-it-works", "/changelog", "/privacy", "/skill/", "/api/search", "/api/methodology", "/api/health", "/ticker/"],
        disallow: ["/dashboard", "/trending", "/connections", "/performance", "/portfolio", "/profile", "/subscription", "/admin", "/paper-trading", "/api/"],
      },
    ],
    sitemap: "http://localhost:3000/sitemap.xml",
  };
}
