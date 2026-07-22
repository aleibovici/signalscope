/**
 * Public base URL for the self-hosted app (no trailing slash).
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://your-host.example).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

/** Absolute URL for a path on this deployment. */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path) return base;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
