import { NextResponse } from "next/server";
import { blogPosts } from "@/lib/blog-data";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import { getIndexNowKey } from "@/lib/indexnow";

function getHost(): string {
  return new URL(getSiteUrl()).hostname;
}

function getPublicUrls(): string[] {
  return [
    absoluteUrl("/login"),
    absoluteUrl("/register"),
    absoluteUrl("/blog"),
    ...blogPosts.map((p) => absoluteUrl(`/blog/${p.slug}`)),
    absoluteUrl("/faq"),
    absoluteUrl("/how-it-works"),
    absoluteUrl("/changelog"),
    absoluteUrl("/dashboard"),
    absoluteUrl("/trending"),
    absoluteUrl("/connections"),
  ];
}

// POST /api/indexnow — submit public URLs to IndexNow (Bing, Yandex)
// Protected by CRON_SECRET so only trusted callers can trigger it.
// The key itself is per-deployment: set INDEXNOW_KEY to your own value, which is
// published at /indexnow-key.txt (src/app/indexnow-key.txt/route.ts).
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = getIndexNowKey();
  if (!key) {
    return NextResponse.json({ error: "INDEXNOW_KEY not configured" }, { status: 503 });
  }

  const host = getHost();
  const urlList = getPublicUrls();

  const body = {
    host,
    key,
    keyLocation: absoluteUrl("/indexnow-key.txt"),
    urlList,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  return NextResponse.json(
    { submitted: urlList, status: res.status },
    { status: res.ok ? 200 : 502 }
  );
}
