import { describe, it, expect } from "vitest";
import { isTransactionActive, transactionToUpsertData } from "@/lib/apple-iap";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

function tx(overrides: Partial<JWSTransactionDecodedPayload> = {}): JWSTransactionDecodedPayload {
  const now = Date.now();
  return {
    originalTransactionId: "1000000000000001",
    productId: "com.signalscopes.ios.pro.monthly",
    bundleId: "com.signalscopes.ios",
    environment: "Sandbox",
    purchaseDate: now - 60_000,
    expiresDate: now + 30 * 24 * 3600 * 1000,
    revocationDate: undefined,
    isUpgraded: false,
    ...overrides,
  } as JWSTransactionDecodedPayload;
}

describe("isTransactionActive", () => {
  it("active when not revoked, not upgraded, expires in the future", () => {
    expect(isTransactionActive(tx())).toBe(true);
  });

  it("inactive when revoked", () => {
    expect(isTransactionActive(tx({ revocationDate: Date.now() - 1000 }))).toBe(false);
  });

  it("inactive when upgraded (superseded by newer transaction)", () => {
    expect(isTransactionActive(tx({ isUpgraded: true }))).toBe(false);
  });

  it("inactive when expired", () => {
    expect(isTransactionActive(tx({ expiresDate: Date.now() - 1000 }))).toBe(false);
  });

  it("inactive when expiresDate missing", () => {
    expect(isTransactionActive(tx({ expiresDate: undefined }))).toBe(false);
  });
});

describe("transactionToUpsertData", () => {
  it("APPLE provider with stripe fields cleared", () => {
    const data = transactionToUpsertData(tx());
    expect(data.provider).toBe("APPLE");
    expect(data.stripeSubscriptionId).toBeNull();
    expect(data.stripePriceId).toBeNull();
  });

  it("ACTIVE status when transaction is active", () => {
    const data = transactionToUpsertData(tx());
    expect(data.status).toBe("ACTIVE");
    expect(data.canceledAt).toBeNull();
  });

  it("CANCELED status when transaction revoked", () => {
    const revoked = Date.now() - 1000;
    const data = transactionToUpsertData(tx({ revocationDate: revoked }));
    expect(data.status).toBe("CANCELED");
    expect(data.canceledAt).toEqual(new Date(revoked));
  });

  it("CANCELED status when transaction upgraded", () => {
    const data = transactionToUpsertData(tx({ isUpgraded: true }));
    expect(data.status).toBe("CANCELED");
  });

  it("cancelAtPeriodEnd reflects autoRenewStatus=false", () => {
    const data = transactionToUpsertData(tx(), { autoRenewStatus: false });
    expect(data.cancelAtPeriodEnd).toBe(true);
  });

  it("cancelAtPeriodEnd false when autoRenewStatus=true", () => {
    const data = transactionToUpsertData(tx(), { autoRenewStatus: true });
    expect(data.cancelAtPeriodEnd).toBe(false);
  });

  it("revokedNow forces CANCELED even if transaction would be active", () => {
    const data = transactionToUpsertData(tx(), { revokedNow: true });
    expect(data.status).toBe("CANCELED");
    expect(data.canceledAt).toBeInstanceOf(Date);
  });

  it("propagates appleProductId and originalTransactionId", () => {
    const data = transactionToUpsertData(
      tx({ productId: "com.signalscopes.ios.pro.annual", originalTransactionId: "9" })
    );
    expect(data.appleProductId).toBe("com.signalscopes.ios.pro.annual");
    expect(data.appleOriginalTransactionId).toBe("9");
  });
});
