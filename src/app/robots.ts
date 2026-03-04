import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/dashboard", "/portfolio", "/history", "/ticker/", "/api/"],
      },
    ],
    sitemap: "https://signalscopes.com/sitemap.xml",
  };
}
