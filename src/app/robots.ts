import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/blog", "/faq", "/how-it-works", "/changelog", "/skill/", "/api/search", "/api/methodology", "/api/health", "/dashboard", "/trending", "/connections", "/performance", "/methodology", "/ticker/"],
        disallow: ["/portfolio", "/profile", "/subscription", "/admin", "/api/"],
      },
    ],
    sitemap: "http://localhost:3000/sitemap.xml",
  };
}
