import { chatJSON } from "@/lib/ai";
import type { AiCostContext } from "@/lib/ai/types";
import { TOOL_REGISTRY, TOOL_DEFINITIONS } from "@/lib/harvester/report-tools";
import type { ToolName, ToolResult } from "@/lib/harvester/report-tools";
import type { TickerReport } from "@/lib/harvester/types";

const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_TIMEOUT_MS = 25_000;

// Pre-serialize tool definitions once at module load
const TOOL_DEFINITIONS_JSON = JSON.stringify(TOOL_DEFINITIONS, null, 2);

export interface ChatReACTConfig {
  symbol: string;
  scanId: string;
  initialContext: string;
  reportSystemPrompt: string;
  temperature: number;
  maxIterations?: number;
  timeoutMs?: number;
  context?: AiCostContext;
}

interface ToolCallResponse {
  action: "tool_call";
  tool: string;
  parameters: Record<string, string>;
  reasoning?: string;
}

interface FinalAnswerResponse {
  action: "final_answer";
  catalyst: string;
  risks: string;
  /** Optional — recommendation is computed server-side; LLM should not emit it. */
  recommendation?: string;
  report: string;
  tradeSetup?: TickerReport["tradeSetup"];
}

type ReACTResponse = ToolCallResponse | FinalAnswerResponse;

function buildReACTSystemPrompt(reportSystemPrompt: string): string {
  return `${reportSystemPrompt}

--- REACT TOOL USE ---

You have access to data retrieval tools. Before writing your final report, you may call tools to gather additional data. Each response must be valid JSON in one of two formats:

FORMAT 1 — Call a tool:
{"action":"tool_call","tool":"<tool_name>","parameters":{...},"reasoning":"<why you need this data>"}

FORMAT 2 — Final report (when you have enough data):
{"action":"final_answer","catalyst":"...","risks":"...","report":"...","tradeSetup":{...}}

The final_answer format must match the report JSON schema described above.

AVAILABLE TOOLS:
${TOOL_DEFINITIONS_JSON}

STRATEGY:
- Call get_all_signals first to see the full signal set (you only have a sample in the initial data).
- Call get_performance if the ticker has prior appearances (priorAppearances > 0) to see how past detections performed.
- Call get_current_price if fundamentals are missing or you need a live price check.
- Call get_peer_context if sector info is available, to compare against similar tickers.
- Call get_price_snapshots if you want to see the recent price trend.
- You do NOT need to call all tools. Only call what adds value to your analysis.
- When you have enough information, produce the final_answer.`;
}

function buildUserMessage(
  initialContext: string,
  toolResults: ToolResult[],
  iteration: number,
  maxIterations: number
): string {
  let msg = initialContext;

  if (toolResults.length > 0) {
    msg += "\n\n--- Tool Results ---";
    for (let i = 0; i < toolResults.length; i++) {
      const tr = toolResults[i];
      if (tr.error) {
        msg += `\n[${i + 1}] ${tr.tool} → ERROR: ${tr.error}`;
      } else {
        msg += `\n[${i + 1}] ${tr.tool} → ${JSON.stringify(tr.result)}`;
      }
    }
    msg += "\n---";
  }

  const remaining = maxIterations - iteration;
  if (remaining <= 1) {
    msg += "\n\nYou have used all tool calls. You MUST produce a final_answer NOW with the data gathered so far.";
  } else {
    msg += `\n\nYou have used ${iteration}/${maxIterations} tool calls. Continue analysis or produce final_answer.`;
  }

  return msg;
}

function parseReACTResponse(content: string): ReACTResponse | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.action === "tool_call" && typeof parsed.tool === "string") {
      return parsed as ToolCallResponse;
    }
    if (
      parsed.action === "final_answer" &&
      typeof parsed.catalyst === "string" &&
      typeof parsed.risks === "string" &&
      typeof parsed.report === "string"
    ) {
      return parsed as FinalAnswerResponse;
    }
    // If it has report fields but no action, treat as final answer
    if (
      typeof parsed.catalyst === "string" &&
      typeof parsed.risks === "string" &&
      typeof parsed.report === "string"
    ) {
      return { action: "final_answer", ...parsed } as FinalAnswerResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function validateTradeSetup(ts: unknown): TickerReport["tradeSetup"] | undefined {
  if (!ts || typeof ts !== "object") return undefined;
  const t = ts as Record<string, unknown>;
  if (
    typeof t.entryLo !== "number" ||
    typeof t.entryHi !== "number" ||
    typeof t.stopLoss !== "number" ||
    typeof t.target1 !== "number" ||
    typeof t.target2 !== "number" ||
    typeof t.timeframe !== "string" ||
    typeof t.riskReward !== "string" ||
    typeof t.confidence !== "string"
  ) {
    return undefined;
  }
  return t as unknown as TickerReport["tradeSetup"];
}

function toTickerReport(fa: FinalAnswerResponse): TickerReport {
  return {
    catalyst: fa.catalyst,
    risks: fa.risks,
    // Placeholder — caller overwrites via deriveRecommendation server-side.
    recommendation: fa.recommendation ?? "Watch",
    report: fa.report,
    tradeSetup: validateTradeSetup(fa.tradeSetup),
  };
}

export async function chatReACT(config: ChatReACTConfig): Promise<TickerReport> {
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  const systemPrompt = buildReACTSystemPrompt(config.reportSystemPrompt);
  const toolResults: ToolResult[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn(`[react] Timeout after ${iteration} iterations for ${config.symbol}, forcing final answer`);
      break;
    }

    const isLastIteration = iteration === maxIterations - 1;
    const userMessage = buildUserMessage(config.initialContext, toolResults, iteration, maxIterations);

    const response = await chatJSON({
      callPoint: "report",
      tier: isLastIteration ? "standard" : "mini",
      temperature: config.temperature,
      systemPrompt,
      userMessage,
      context: config.context,
    });

    const parsed = parseReACTResponse(response.content);

    if (!parsed) {
      console.warn(`[react] Malformed response at iteration ${iteration} for ${config.symbol}, forcing final answer`);
      break;
    }

    if (parsed.action === "final_answer") {
      console.log(`[react] ${config.symbol} completed in ${iteration + 1} iterations (${toolResults.length} tool calls)`);
      return toTickerReport(parsed);
    }

    // Execute tool call
    const toolName = parsed.tool;
    const executor = TOOL_REGISTRY[toolName as ToolName];

    if (!executor) {
      console.warn(`[react] Unknown tool "${toolName}" requested for ${config.symbol}`);
      toolResults.push({ tool: toolName, result: null, error: `Unknown tool: ${toolName}` });
      continue;
    }

    const params = { ...parsed.parameters };
    if (!params.symbol) params.symbol = config.symbol;
    if (!params.scanId) params.scanId = config.scanId;

    console.log(`[react] ${config.symbol} iteration ${iteration + 1}: calling ${toolName}${parsed.reasoning ? ` (${parsed.reasoning})` : ""}`);

    try {
      const result = await executor(params);
      toolResults.push({ tool: toolName, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[react] Tool ${toolName} failed for ${config.symbol}: ${msg}`);
      toolResults.push({ tool: toolName, result: null, error: msg });
    }
  }

  // Force a final answer
  console.log(`[react] ${config.symbol} forcing final answer after ${toolResults.length} tool calls`);

  const finalMessage = buildUserMessage(config.initialContext, toolResults, maxIterations, maxIterations);
  const finalResponse = await chatJSON({
    callPoint: "report",
    tier: "standard",
    temperature: config.temperature,
    systemPrompt,
    userMessage: finalMessage,
    context: config.context,
  });

  const finalParsed = parseReACTResponse(finalResponse.content);
  if (finalParsed && finalParsed.action === "final_answer") {
    return toTickerReport(finalParsed);
  }

  throw new Error(`ReACT loop failed to produce valid report for ${config.symbol}`);
}

// Exported for testing and reuse by report.ts
export { buildReACTSystemPrompt, buildUserMessage, parseReACTResponse, validateTradeSetup };
