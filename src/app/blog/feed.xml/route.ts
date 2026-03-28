import { blogPosts } from "@/lib/blog-data";
import { NextResponse } from "next/server";

const BASE_URL = "http://localhost:3000";

export const revalidate = 86400; // cache for 24 hours

export function GET() {
  const items = blogPosts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.description}]]></description>
      ${post.tags.map((t) => `<category>${t}</category>`).join("\n      ")}
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SignalScope Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Insights on stock breakout signals, AI scoring, pump-and-dump detection, congressional trades, and market analysis from the SignalScope team.</description>
    <language>en-us</language>
    <managingEditor>REDACTED (SignalScope)</managingEditor>
    <webMaster>REDACTED (SignalScope)</webMaster>
    <lastBuildDate>${new Date(blogPosts[0]?.date ?? new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/apple-touch-icon.png</url>
      <title>SignalScope Blog</title>
      <link>${BASE_URL}/blog</link>
    </image>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
