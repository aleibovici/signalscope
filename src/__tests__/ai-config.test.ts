import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to re-import the module fresh each test to pick up env changes.
// Use vi.resetModules() and dynamic import inside each test.

const importConfig = () =>
  import("@/lib/ai/config").then((m) => m.resolveProviderOrder);

describe("resolveProviderOrder", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear relevant env vars before each test
    delete process.env.AI_PRIMARY_PROVIDER;
    delete process.env.AI_PROVIDER_SCORING;
    delete process.env.AI_PROVIDER_PND;
    delete process.env.AI_PROVIDER_REPORT;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("defaults to openai as primary when no env vars are set and openai has no key", async () => {
    const resolve = await importConfig();
    // Neither key is set — openai is primary but has no key; anthropic also has no key
    // Falls through to [openai, null] since no secondary key either
    const [primary] = resolve("scoring");
    // The function: if primary has no key AND secondary has key → return [secondary, null]
    // Here neither has a key, so it returns [primary="openai", secondary=null (no key)]
    expect(primary).toBe("openai");
  });

  it("uses openai as primary when OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const resolve = await importConfig();
    const [primary] = resolve("scoring");
    expect(primary).toBe("openai");
  });

  it("returns openai as primary with anthropic as secondary when both keys present", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    const [primary, secondary] = resolve("scoring");
    expect(primary).toBe("openai");
    expect(secondary).toBe("anthropic");
  });

  it("falls back to anthropic as primary when openai has no key but anthropic does", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    const [primary, secondary] = resolve("scoring");
    expect(primary).toBe("anthropic");
    expect(secondary).toBeNull();
  });

  it("respects AI_PRIMARY_PROVIDER=anthropic", async () => {
    process.env.AI_PRIMARY_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    process.env.OPENAI_API_KEY = "sk-openai-key";
    const resolve = await importConfig();
    const [primary, secondary] = resolve("scoring");
    expect(primary).toBe("anthropic");
    expect(secondary).toBe("openai");
  });

  it("respects AI_PROVIDER_SCORING per-call-point override", async () => {
    process.env.AI_PRIMARY_PROVIDER = "openai";
    process.env.AI_PROVIDER_SCORING = "anthropic";
    process.env.OPENAI_API_KEY = "sk-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    const [primary] = resolve("scoring");
    expect(primary).toBe("anthropic");
  });

  it("respects AI_PROVIDER_PND per-call-point override", async () => {
    process.env.AI_PRIMARY_PROVIDER = "openai";
    process.env.AI_PROVIDER_PND = "anthropic";
    process.env.OPENAI_API_KEY = "sk-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    const [primary] = resolve("pnd");
    expect(primary).toBe("anthropic");
  });

  it("respects AI_PROVIDER_REPORT per-call-point override", async () => {
    process.env.AI_PRIMARY_PROVIDER = "openai";
    process.env.AI_PROVIDER_REPORT = "anthropic";
    process.env.OPENAI_API_KEY = "sk-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    const [primary] = resolve("report");
    expect(primary).toBe("anthropic");
  });

  it("call-point override does not affect other call points", async () => {
    process.env.AI_PROVIDER_SCORING = "anthropic";
    process.env.OPENAI_API_KEY = "sk-openai-key";
    process.env.ANTHROPIC_API_KEY = "sk-ant-key";
    const resolve = await importConfig();
    // pnd uses the global primary (openai) not the scoring override
    const [primary] = resolve("pnd");
    expect(primary).toBe("openai");
  });

  it("secondary is null when only one provider has a key", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-key";
    const resolve = await importConfig();
    const [, secondary] = resolve("scoring");
    expect(secondary).toBeNull();
  });
});
