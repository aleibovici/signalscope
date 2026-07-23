import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIndexNowKey } from "@/lib/indexnow";

describe("getIndexNowKey", () => {
  const original = process.env.INDEXNOW_KEY;

  beforeEach(() => {
    delete process.env.INDEXNOW_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = original;
  });

  it("returns null when unset, so IndexNow stays disabled by default", () => {
    expect(getIndexNowKey()).toBeNull();
  });

  it("returns null for a blank value", () => {
    process.env.INDEXNOW_KEY = "   ";
    expect(getIndexNowKey()).toBeNull();
  });

  it("returns a valid key, trimmed", () => {
    process.env.INDEXNOW_KEY = "  f8dd4b98a32e43dba4ffefb26738aecb  ";
    expect(getIndexNowKey()).toBe("f8dd4b98a32e43dba4ffefb26738aecb");
  });

  it("rejects keys that could escape the key-file path", () => {
    for (const bad of ["../../etc/passwd", "key with spaces", "key/slash", "short"]) {
      process.env.INDEXNOW_KEY = bad;
      expect(getIndexNowKey()).toBeNull();
    }
  });
});
