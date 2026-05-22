import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatJSONRequest, ChatJSONResponse } from "@/lib/ai/types";

// Mock chatJSON
const mockChatJSON = vi.fn<(req: ChatJSONRequest) => Promise<ChatJSONResponse>>();
vi.mock("@/lib/ai", () => ({
  chatJSON: (req: ChatJSONRequest) => mockChatJSON(req),
}));

// Mock tool registry
const mockGetAllSignals = vi.fn();
const mockGetPerformance = vi.fn();
vi.mock("@/lib/harvester/report-tools", () => ({
  TOOL_REGISTRY: {
    get_all_signals: (p: Record<string, string>) => mockGetAllSignals(p),
    get_current_price: vi.fn().mockResolvedValue({ symbol: "TEST", price: 10 }),
    get_performance: (p: Record<string, string>) => mockGetPerformance(p),
    get_history: vi.fn().mockResolvedValue({ symbol: "TEST", appearances: [] }),
    get_peer_context: vi.fn().mockResolvedValue({ peers: [] }),
    get_price_snapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
  },
  TOOL_DEFINITIONS: [
    { name: "get_all_signals", description: "Get signals", parameters: {} },
    { name: "get_performance", description: "Get perf", parameters: {} },
  ],
}));

const { chatReACT, parseReACTResponse, buildUserMessage, validateTradeSetup } = await import("@/lib/ai/react");

const baseConfig = {
  symbol: "TEST",
  scanId: "scan1",
  initialContext: '{"symbol":"TEST","aiScore":75}',
  reportSystemPrompt: "You are a test analyst.",
  temperature: 0.4,
};

const finalAnswer = {
  action: "final_answer",
  catalyst: "Test catalyst",
  risks: "Test risks",
  recommendation: "Watch",
  report: "Test report paragraph.",
};

describe("parseReACTResponse", () => {
  it("parses tool_call response", () => {
    const input = JSON.stringify({ action: "tool_call", tool: "get_all_signals", parameters: { symbol: "TEST" } });
    const result = parseReACTResponse(input);
    expect(result).toEqual({ action: "tool_call", tool: "get_all_signals", parameters: { symbol: "TEST" } });
  });

  it("parses final_answer response", () => {
    const input = JSON.stringify(finalAnswer);
    const result = parseReACTResponse(input);
    expect(result?.action).toBe("final_answer");
  });

  it("parses response without action field as final_answer if it has report fields", () => {
    const input = JSON.stringify({ catalyst: "C", risks: "R", recommendation: "Watch", report: "Report" });
    const result = parseReACTResponse(input);
    expect(result?.action).toBe("final_answer");
  });

  it("returns null for invalid JSON", () => {
    expect(parseReACTResponse("not json")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(parseReACTResponse('{"action":"tool_call"}')).toBeNull();
    expect(parseReACTResponse('{"catalyst":"only one field"}')).toBeNull();
  });
});

describe("buildUserMessage", () => {
  it("includes initial context", () => {
    const msg = buildUserMessage("initial data", [], 0, 5);
    expect(msg).toContain("initial data");
    expect(msg).toContain("0/5 tool calls");
  });

  it("includes tool results", () => {
    const msg = buildUserMessage("data", [{ tool: "get_all_signals", result: { count: 5 } }], 1, 5);
    expect(msg).toContain("get_all_signals");
    expect(msg).toContain('"count":5');
  });

  it("includes error results", () => {
    const msg = buildUserMessage("data", [{ tool: "bad_tool", result: null, error: "Unknown tool" }], 1, 5);
    expect(msg).toContain("ERROR: Unknown tool");
  });

  it("forces final answer on last iteration", () => {
    const msg = buildUserMessage("data", [], 4, 5);
    expect(msg).toContain("MUST produce a final_answer NOW");
  });
});

describe("validateTradeSetup", () => {
  it("returns valid trade setup with all fields", () => {
    const ts = {
      entryLo: 10,
      entryHi: 11,
      stopLoss: 9,
      target1: 13,
      target2: 15,
      timeframe: "1-3 days",
      riskReward: "1:2",
      confidence: "Medium",
    };
    expect(validateTradeSetup(ts)).toEqual(ts);
  });

  it("accepts minimal LLM shape (entryLo/entryHi/confidence only) and fills placeholders", () => {
    // The LLM emits only the three fields it owns; bracket math is filled by
    // applyAnchoredBracket downstream. Placeholders here must NOT block the
    // tradeSetup from being returned.
    const ts = { entryLo: 4.5, entryHi: 4.65, confidence: "Medium" };
    const result = validateTradeSetup(ts);
    expect(result).toBeDefined();
    expect(result!.entryLo).toBe(4.5);
    expect(result!.entryHi).toBe(4.65);
    expect(result!.confidence).toBe("Medium");
    expect(result!.stopLoss).toBe(0);
    expect(result!.target1).toBe(0);
    expect(result!.target2).toBe(0);
    expect(result!.timeframe).toBe("");
    expect(result!.riskReward).toBe("");
  });

  it("accepts entryLo/entryHi only and defaults confidence to Medium", () => {
    const ts = { entryLo: 4.5, entryHi: 4.65 };
    const result = validateTradeSetup(ts);
    expect(result).toBeDefined();
    expect(result!.confidence).toBe("Medium");
  });

  it("coerces unrecognized confidence to Medium", () => {
    const ts = { entryLo: 10, entryHi: 11, confidence: "extremely high" };
    expect(validateTradeSetup(ts)!.confidence).toBe("Medium");
  });

  it("returns undefined for null/undefined", () => {
    expect(validateTradeSetup(null)).toBeUndefined();
    expect(validateTradeSetup(undefined)).toBeUndefined();
  });

  it("returns undefined when entry range is missing or invalid", () => {
    expect(validateTradeSetup({ entryLo: "not a number" })).toBeUndefined();
    expect(validateTradeSetup({ entryLo: 10 })).toBeUndefined();
    expect(validateTradeSetup({ entryHi: 11 })).toBeUndefined();
    expect(validateTradeSetup({ entryLo: NaN, entryHi: 11 })).toBeUndefined();
    expect(validateTradeSetup({ entryLo: 10, entryHi: Infinity })).toBeUndefined();
  });
});

describe("chatReACT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllSignals.mockResolvedValue({ count: 5, signals: [] });
    mockGetPerformance.mockResolvedValue({ symbol: "TEST", records: [] });
  });

  it("completes with immediate final_answer", async () => {
    mockChatJSON.mockResolvedValue({ content: JSON.stringify(finalAnswer), provider: "openai" });

    const result = await chatReACT(baseConfig);
    expect(result.catalyst).toBe("Test catalyst");
    expect(result.recommendation).toBe("Watch");
    expect(mockChatJSON).toHaveBeenCalledTimes(1);
  });

  it("executes tool_call then final_answer", async () => {
    mockChatJSON
      .mockResolvedValueOnce({
        content: JSON.stringify({
          action: "tool_call",
          tool: "get_all_signals",
          parameters: { symbol: "TEST", scanId: "scan1" },
          reasoning: "Need full signals",
        }),
        provider: "openai",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(finalAnswer),
        provider: "openai",
      });

    const result = await chatReACT(baseConfig);
    expect(mockChatJSON).toHaveBeenCalledTimes(2);
    expect(mockGetAllSignals).toHaveBeenCalledOnce();
    expect(result.catalyst).toBe("Test catalyst");
  });

  it("uses mini tier for tool calls and standard for final answer when forced", async () => {
    // 5 tool calls to hit max iterations, then forced final
    for (let i = 0; i < 5; i++) {
      mockChatJSON.mockResolvedValueOnce({
        content: JSON.stringify({
          action: "tool_call",
          tool: "get_all_signals",
          parameters: {},
        }),
        provider: "openai",
      });
    }
    // Forced final answer
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify(finalAnswer),
      provider: "openai",
    });

    await chatReACT({ ...baseConfig, maxIterations: 5 });

    // First 4 calls should be mini, 5th (last iteration) should be standard
    const calls = mockChatJSON.mock.calls;
    expect(calls[0][0].tier).toBe("mini");
    expect(calls[3][0].tier).toBe("mini");
    expect(calls[4][0].tier).toBe("standard"); // last iteration
    expect(calls[5][0].tier).toBe("standard"); // forced final
  });

  it("handles unknown tool gracefully", async () => {
    mockChatJSON
      .mockResolvedValueOnce({
        content: JSON.stringify({
          action: "tool_call",
          tool: "nonexistent_tool",
          parameters: {},
        }),
        provider: "openai",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(finalAnswer),
        provider: "openai",
      });

    const result = await chatReACT(baseConfig);
    expect(result.catalyst).toBe("Test catalyst");
    // Second call should have error in context
    const secondCall = mockChatJSON.mock.calls[1][0].userMessage;
    expect(secondCall).toContain("Unknown tool: nonexistent_tool");
  });

  it("handles tool execution error", async () => {
    mockGetAllSignals.mockRejectedValueOnce(new Error("DB connection failed"));

    mockChatJSON
      .mockResolvedValueOnce({
        content: JSON.stringify({
          action: "tool_call",
          tool: "get_all_signals",
          parameters: {},
        }),
        provider: "openai",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(finalAnswer),
        provider: "openai",
      });

    const result = await chatReACT(baseConfig);
    expect(result.catalyst).toBe("Test catalyst");
    const secondCall = mockChatJSON.mock.calls[1][0].userMessage;
    expect(secondCall).toContain("DB connection failed");
  });

  it("forces final answer on malformed response", async () => {
    mockChatJSON
      .mockResolvedValueOnce({
        content: "not valid json at all",
        provider: "openai",
      })
      // Forced final
      .mockResolvedValueOnce({
        content: JSON.stringify(finalAnswer),
        provider: "openai",
      });

    const result = await chatReACT(baseConfig);
    expect(result.catalyst).toBe("Test catalyst");
  });

  it("enforces max iterations", async () => {
    // Return tool_call for every iteration
    for (let i = 0; i < 3; i++) {
      mockChatJSON.mockResolvedValueOnce({
        content: JSON.stringify({ action: "tool_call", tool: "get_all_signals", parameters: {} }),
        provider: "openai",
      });
    }
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify(finalAnswer),
      provider: "openai",
    });

    const result = await chatReACT({ ...baseConfig, maxIterations: 3 });
    expect(result.catalyst).toBe("Test catalyst");
    // 3 iterations (last one forces standard tier) + 1 forced final = 4 calls
    expect(mockChatJSON).toHaveBeenCalledTimes(4);
  });

  it("throws when forced final answer also fails", async () => {
    mockChatJSON
      .mockResolvedValueOnce({ content: "bad", provider: "openai" })
      .mockResolvedValueOnce({ content: "also bad", provider: "openai" });

    await expect(chatReACT({ ...baseConfig, maxIterations: 1 })).rejects.toThrow(
      "ReACT loop failed to produce valid report"
    );
  });

  it("injects symbol/scanId if AI omits them", async () => {
    mockChatJSON
      .mockResolvedValueOnce({
        content: JSON.stringify({
          action: "tool_call",
          tool: "get_all_signals",
          parameters: {}, // No symbol/scanId
        }),
        provider: "openai",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(finalAnswer),
        provider: "openai",
      });

    await chatReACT(baseConfig);
    expect(mockGetAllSignals).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "TEST", scanId: "scan1" })
    );
  });

  it("drops invalid tradeSetup from final answer", async () => {
    mockChatJSON.mockResolvedValueOnce({
      content: JSON.stringify({
        ...finalAnswer,
        tradeSetup: { entryLo: "not a number" },
      }),
      provider: "openai",
    });

    const result = await chatReACT(baseConfig);
    expect(result.tradeSetup).toBeUndefined();
  });
});
