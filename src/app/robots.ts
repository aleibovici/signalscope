import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/blog", "/faq", "/how-it-works", "/changelog", "/skill/", "/api/search", "/api/methodology", "/api/health"],
        disallow: ["/dashboard", "/portfolio", "/history", "/ticker/", "/api/"],
      },
    ],
    sitemap: "https://signalscopes.com/sitemap.xml",
  };
}
