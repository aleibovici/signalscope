import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatJSONRequest, ChatJSONResponse } from "@/lib/ai/types";

const mockOpenAI = vi.fn<(req: ChatJSONRequest) => Promise<ChatJSONResponse>>();
const mockAnthropic = vi.fn<(req: ChatJSONRequest) => Promise<ChatJSONResponse>>();
const mockResolve = vi.fn<(s: string) => [string, string | null]>();

vi.mock("@/lib/ai/openai", () => ({ chatJSONOpenAI: mockOpenAI }));
vi.mock("@/lib/ai/anthropic", () => ({ chatJSONAnthropic: mockAnthropic }));
vi.mock("@/lib/ai/config", () => ({ resolveProviderOrder: mockResolve }));
vi.mock("@/lib/ai/cost-tracker", () => ({
  addCost: vi.fn(),
  resetCostTracker: vi.fn(),
  getTotalCost: vi.fn(() => 0),
}));

const { chatJSON } = await import("@/lib/ai/index");
const { addCost } = await import("@/lib/ai/cost-tracker");

const dummyRequest: ChatJSONRequest = {
  callPoint: "scoring",
  tier: "mini",
  temperature: 0.3,
  systemPrompt: "test",
  userMessage: "test",
};

const successResponse: ChatJSONResponse = {
  content: '{"result": "ok"}',
  provider: "openai",
  cost: 0.01,
};

describe("chatJSON — primary success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockReturnValue(["openai", "anthropic"]);
  });

  it("calls primary provider and returns result", async () => {
    mockOpenAI.mockResolvedValue(successResponse);
    const result = await chatJSON(dummyRequest);
    expect(mockOpenAI).toHaveBeenCalledOnce();
    expect(mockAnthropic).not.toHaveBeenCalled();
    expect(result).toEqual(successResponse);
  });

  it("tracks cost from primary response", async () => {
    mockOpenAI.mockResolvedValue(successResponse);
    await chatJSON(dummyRequest);
    expect(addCost).toHaveBeenCalledWith(0.01);
  });

  it("does not track cost when response has no cost field", async () => {
    mockOpenAI.mockResolvedValue({ content: "{}", provider: "openai" });
    await chatJSON(dummyRequest);
    expect(addCost).not.toHaveBeenCalled();
  });
});

describe("chatJSON — primary fails, secondary succeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockReturnValue(["openai", "anthropic"]);
  });

  it("falls back to secondary when primary throws", async () => {
    mockOpenAI.mockRejectedValue(new Error("openai down"));
    mockAnthropic.mockResolvedValue(successResponse);
    const result = await chatJSON(dummyRequest);
    expect(mockOpenAI).toHaveBeenCalledOnce();
    expect(mockAnthropic).toHaveBeenCalledOnce();
    expect(result).toEqual(successResponse);
  });

  it("tracks cost from secondary response", async () => {
    mockOpenAI.mockRejectedValue(new Error("openai down"));
    mockAnthropic.mockResolvedValue({ content: "{}", provider: "anthropic", cost: 0.02 });
    await chatJSON(dummyRequest);
    expect(addCost).toHaveBeenCalledWith(0.02);
  });
});

describe("chatJSON — both providers fail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockReturnValue(["openai", "anthropic"]);
  });

  it("throws primary error when both fail", async () => {
    const primaryErr = new Error("openai down");
    mockOpenAI.mockRejectedValue(primaryErr);
    mockAnthropic.mockRejectedValue(new Error("anthropic down"));
    await expect(chatJSON(dummyRequest)).rejects.toThrow("openai down");
  });

  it("does not track cost when both fail", async () => {
    mockOpenAI.mockRejectedValue(new Error("openai down"));
    mockAnthropic.mockRejectedValue(new Error("anthropic down"));
    await chatJSON(dummyRequest).catch(() => {});
    expect(addCost).not.toHaveBeenCalled();
  });
});

describe("chatJSON — no secondary provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockReturnValue(["openai", null]);
  });

  it("throws immediately when primary fails and no secondary", async () => {
    mockOpenAI.mockRejectedValue(new Error("openai down"));
    await expect(chatJSON(dummyRequest)).rejects.toThrow("openai down");
    expect(mockAnthropic).not.toHaveBeenCalled();
  });
});

describe("chatJSON — passes request to provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockReturnValue(["anthropic", null]);
  });

  it("passes the full request object to the resolved provider", async () => {
    mockAnthropic.mockResolvedValue(successResponse);
    await chatJSON(dummyRequest);
    expect(mockAnthropic).toHaveBeenCalledWith(dummyRequest);
  });
});
