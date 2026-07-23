import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";

// Mock NextResponse so we don't need the Next.js runtime
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

const { handleApiError } = await import("@/lib/api-error");

describe("handleApiError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 for 'Not authenticated' error", () => {
    const err = new Error("Not authenticated");
    const res = handleApiError(err, "test") as { body: unknown; status: number };
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it("returns 400 for ZodError with issue details", () => {
    const schema = z.object({ name: z.string() });
    let zodErr: z.ZodError | null = null;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodErr = e as z.ZodError;
    }
    const res = handleApiError(zodErr!, "test") as { body: unknown; status: number };
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("Validation failed");
    expect((res.body as { details: unknown[] }).details).toHaveLength(1);
  });

  it("returns 500 for unknown errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("Something exploded");
    const res = handleApiError(err, "test") as { body: unknown; status: number };
    expect(res.status).toBe(500);
    expect((res.body as { error: string }).error).toBe("Internal server error");
  });

  it("returns 500 for non-Error values (string, object, etc.)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError("raw string error", "test") as { body: unknown; status: number };
    expect(res.status).toBe(500);
  });

  it("logs unknown errors with the provided label", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    handleApiError(new Error("boom"), "portfolio-route");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("portfolio-route"),
      expect.any(Error)
    );
  });

  it("does not log for 401 auth errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    handleApiError(new Error("Not authenticated"), "test");
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not log for 400 Zod errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const schema = z.string();
    try { schema.parse(123); } catch (e) { handleApiError(e, "test"); }
    expect(spy).not.toHaveBeenCalled();
  });
});
