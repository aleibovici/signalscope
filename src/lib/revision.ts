/**
 * Build/revision identifier shown in the dashboard footer.
 *
 * Set APP_REVISION explicitly (e.g. to a git SHA) for any host. The remaining
 * lookups pick up the variable each platform injects automatically so the
 * footer stays useful without extra configuration.
 */
export function getAppRevision(): string {
  return (
    process.env.APP_REVISION ??
    process.env.K_REVISION ?? // Google Cloud Run
    process.env.RENDER_GIT_COMMIT ?? // Render
    process.env.RAILWAY_GIT_COMMIT_SHA ?? // Railway
    process.env.VERCEL_GIT_COMMIT_SHA ?? // Vercel
    process.env.FLY_MACHINE_VERSION ?? // Fly.io
    process.env.HEROKU_RELEASE_VERSION ?? // Heroku
    "local"
  );
}
