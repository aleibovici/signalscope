/**
 * IndexNow verification key for this deployment.
 *
 * IndexNow requires the key to be published at `https://<host>/<key>.txt`, so it
 * is public by design — but it must be unique per site. Generate one (e.g.
 * `openssl rand -hex 16`) and set INDEXNOW_KEY; leave it unset to disable
 * IndexNow submissions entirely.
 */
export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return null;
  // IndexNow accepts 8-128 hex-ish characters; reject anything that could
  // escape the /<key>.txt path.
  return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}
