import { getIndexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/**
 * Serves the IndexNow verification key from INDEXNOW_KEY.
 *
 * IndexNow allows the key file to live at a non-root path as long as the
 * submission passes a matching `keyLocation`, which /api/indexnow does. Serving
 * it from env keeps the key per-deployment instead of baking one into the repo.
 */
export async function GET() {
  const key = getIndexNowKey();
  if (!key) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
