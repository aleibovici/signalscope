import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog-data";

const BASE_URL = "https://signalscopes.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Static last-modified dates (update when content actually changes)
  const SITE_CONTENT_DATE = new Date("2026-03-28");

  return [
    {
      url: `${BASE_URL}/login`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(blogPosts[0]?.date ?? SITE_CONTENT_DATE),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogEntries,
    {
      url: `${BASE_URL}/faq`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/how-it-works`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/connections`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/performance`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/skill/SKILL.md`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/skill/api-public.md`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/skill/api-authenticated.md`,
      lastModified: SITE_CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
