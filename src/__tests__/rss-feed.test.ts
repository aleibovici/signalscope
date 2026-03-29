import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock blog-data so tests don't depend on real content
vi.mock("@/lib/blog-data", () => ({
  blogPosts: [
    {
      slug: "test-post-one",
      title: "Test Post One",
      description: "First test post description.",
      date: "2026-03-15",
      readingTime: "4 min read",
      tags: ["signals", "methodology"],
      sections: [{ body: "Body content." }],
    },
    {
      slug: "test-post-two",
      title: "Test Post Two & <Special> Chars",
      description: "Second post with <html> and & entities.",
      date: "2026-02-10",
      readingTime: "3 min read",
      tags: ["getting-started"],
      sections: [{ body: "Another body." }],
    },
  ],
}));

const { GET } = await import("@/app/blog/feed.xml/route");

describe("GET /blog/feed.xml", () => {
  it("returns 200 with XML content-type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
  });

  it("returns valid RSS 2.0 XML with channel wrapper", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("</rss>");
  });

  it("includes all blog posts as <item> elements", async () => {
    const res = await GET();
    const xml = await res.text();
    const itemMatches = xml.match(/<item>/g) ?? [];
    expect(itemMatches).toHaveLength(2);
  });

  it("includes correct slugs in item links and GUIDs", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain("https://signalscopes.com/blog/test-post-one");
    expect(xml).toContain("https://signalscopes.com/blog/test-post-two");
  });

  it("wraps title and description in CDATA to handle special characters", async () => {
    const res = await GET();
    const xml = await res.text();
    // Both title and description must be in CDATA sections
    expect(xml).toContain("<title><![CDATA[Test Post One]]></title>");
    expect(xml).toContain("<title><![CDATA[Test Post Two & <Special> Chars]]></title>");
    expect(xml).toContain("<description><![CDATA[First test post description.]]></description>");
    expect(xml).toContain("<description><![CDATA[Second post with <html> and & entities.]]></description>");
  });

  it("includes tags as <category> elements", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain("<category>signals</category>");
    expect(xml).toContain("<category>methodology</category>");
    expect(xml).toContain("<category>getting-started</category>");
  });

  it("uses the most recent post date as lastBuildDate", async () => {
    const res = await GET();
    const xml = await res.text();
    // blogPosts[0] is 2026-03-15 — should be used in lastBuildDate
    const expected = new Date("2026-03-15").toUTCString();
    expect(xml).toContain(`<lastBuildDate>${expected}</lastBuildDate>`);
  });

  it("sets Cache-Control header for 24h caching", async () => {
    const res = await GET();
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("max-age=86400");
  });

  it("includes atom:link self-reference", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('href="https://signalscopes.com/blog/feed.xml"');
    expect(xml).toContain('rel="self"');
  });
});
