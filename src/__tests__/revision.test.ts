import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppRevision } from "@/lib/revision";

const VARS = [
  "APP_REVISION",
  "K_REVISION",
  "RENDER_GIT_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "FLY_MACHINE_VERSION",
  "HEROKU_RELEASE_VERSION",
];

describe("getAppRevision", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to "local" when no host injects a revision', () => {
    expect(getAppRevision()).toBe("local");
  });

  it("prefers the host-agnostic APP_REVISION over platform variables", () => {
    process.env.K_REVISION = "cloud-run-00042";
    process.env.APP_REVISION = "abc1234";
    expect(getAppRevision()).toBe("abc1234");
  });

  it.each([
    ["K_REVISION", "cloud-run-00042"],
    ["RENDER_GIT_COMMIT", "render-sha"],
    ["RAILWAY_GIT_COMMIT_SHA", "railway-sha"],
    ["VERCEL_GIT_COMMIT_SHA", "vercel-sha"],
    ["FLY_MACHINE_VERSION", "fly-version"],
    ["HEROKU_RELEASE_VERSION", "v42"],
  ])("picks up %s automatically", (key, value) => {
    process.env[key] = value;
    expect(getAppRevision()).toBe(value);
  });
});
