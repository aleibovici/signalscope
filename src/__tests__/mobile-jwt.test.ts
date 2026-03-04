import { describe, it, expect, vi, beforeEach } from "vitest";

// Set AUTH_SECRET before importing the module
vi.stubEnv("AUTH_SECRET", "test-secret-for-jwt-testing-1234567890");

const {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} = await import("@/lib/mobile-jwt");

describe("signAccessToken / verifyAccessToken", () => {
  const payload = { sub: "user_123", email: "test@example.com", role: "user" };

  it("signs and verifies a valid token", async () => {
    const token = await signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const result = await verifyAccessToken(token);
    expect(result).toEqual(payload);
  });

  it("returns null for a tampered token", async () => {
    const token = await signAccessToken(payload);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = await verifyAccessToken(tampered);
    expect(result).toBeNull();
  });

  it("returns null for a garbage string", async () => {
    const result = await verifyAccessToken("not-a-jwt");
    expect(result).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Sign a token, then advance time past expiry
    vi.useFakeTimers();
    const token = await signAccessToken(payload);

    // Advance 16 minutes (token expires in 15)
    vi.advanceTimersByTime(16 * 60 * 1000);

    const result = await verifyAccessToken(token);
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it("preserves sub, email, and role in payload", async () => {
    const adminPayload = { sub: "admin_1", email: "admin@test.com", role: "admin" };
    const token = await signAccessToken(adminPayload);
    const result = await verifyAccessToken(token);
    expect(result).toEqual(adminPayload);
  });
});

describe("generateRefreshToken", () => {
  it("returns a 64-char hex string", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(10);
  });
});

describe("getRefreshTokenExpiry", () => {
  it("returns a date ~30 days in the future", () => {
    const expiry = getRefreshTokenExpiry();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const diff = expiry.getTime() - Date.now();
    // Allow 5 seconds tolerance
    expect(diff).toBeGreaterThan(thirtyDaysMs - 5000);
    expect(diff).toBeLessThan(thirtyDaysMs + 5000);
  });
});
