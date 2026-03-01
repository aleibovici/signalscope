import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/dashboard", "/portfolio", "/history", "/filtered", "/ticker/", "/api/"],
      },
    ],
    sitemap: "http://localhost:3000/sitemap.xml",
  };
}
