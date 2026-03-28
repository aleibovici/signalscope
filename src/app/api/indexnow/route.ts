import { NextResponse } from "next/server";

const INDEXNOW_KEY = "f8dd4b98a32e43dba4ffefb26738aecb";
const HOST = "localhost:3000";

const PUBLIC_URLS = [
  `https://${HOST}/login`,
  `https://${HOST}/register`,
  `https://${HOST}/blog`,
  `https://${HOST}/faq`,
  `https://${HOST}/how-it-works`,
  `https://${HOST}/changelog`,
  `https://${HOST}/dashboard`,
  `https://${HOST}/trending`,
  `https://${HOST}/connections`,
];

// POST /api/indexnow — submit public URLs to IndexNow (Bing, Yandex)
// Protected by CRON_SECRET so only trusted callers can trigger it
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: PUBLIC_URLS,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  return NextResponse.json(
    { submitted: PUBLIC_URLS, status: res.status },
    { status: res.ok ? 200 : 502 }
  );
}
