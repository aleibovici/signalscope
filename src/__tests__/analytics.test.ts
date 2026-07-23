import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// analytics.ts guards on `typeof window !== "undefined"` and `window.dataLayer`.
// In the Node test environment window is undefined — we use vi.stubGlobal to
// simulate both the server-side (no window) and client-side (window + dataLayer)
// scenarios.

const { trackEvent, trackConversion } = await import("@/lib/analytics");

describe("trackEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a no-op when window is undefined (server-side)", () => {
    // Default Node environment has no window — should not throw
    expect(() => trackEvent("test_event")).not.toThrow();
  });

  it("is a no-op when window.dataLayer is not set", () => {
    vi.stubGlobal("window", {}); // window exists but no dataLayer
    expect(() => trackEvent("test_event")).not.toThrow();
  });

  it("pushes { event } to dataLayer when dataLayer is present", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackEvent("page_view");

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual({ event: "page_view" });
  });

  it("spreads params into the dataLayer push", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackEvent("begin_checkout", { currency: "USD", value: 10 });

    expect(dataLayer[0]).toEqual({ event: "begin_checkout", currency: "USD", value: 10 });
  });

  it("pushes multiple events independently", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackEvent("event_a");
    trackEvent("event_b", { foo: "bar" });

    expect(dataLayer).toHaveLength(2);
    expect(dataLayer[0].event).toBe("event_a");
    expect(dataLayer[1].event).toBe("event_b");
    expect(dataLayer[1].foo).toBe("bar");
  });

  it("does not mutate the params object passed in", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    const params = { method: "credentials" };
    trackEvent("login", params);

    // Original object should be unchanged
    expect(params).toEqual({ method: "credentials" });
  });
});

describe("trackConversion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns a Promise", () => {
    const result = trackConversion("sign_up");
    expect(result).toBeInstanceOf(Promise);
  });

  it("resolves after ~300ms (the pixel-flush delay)", async () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    const promise = trackConversion("sign_up");

    // Not resolved yet before the timeout fires
    let resolved = false;
    promise.then(() => { resolved = true; });
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(300);
    await promise;
    expect(resolved).toBe(true);
  });

  it("calls trackEvent before resolving (event fires immediately)", async () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    const promise = trackConversion("begin_checkout", { value: 10 });

    // Event should be pushed synchronously before the promise resolves
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual({ event: "begin_checkout", value: 10 });

    vi.advanceTimersByTime(300);
    await promise;
  });

  it("passes params through to dataLayer", async () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    const promise = trackConversion("generate_api_key");
    vi.advanceTimersByTime(300);
    await promise;

    expect(dataLayer[0]).toEqual({ event: "generate_api_key" });
  });

  it("is a no-op (does not throw) when window is undefined", async () => {
    // Node environment default — no window
    const promise = trackConversion("login");
    vi.advanceTimersByTime(300);
    await expect(promise).resolves.toBeUndefined();
  });
});
