export type AiProvider = "openai" | "anthropic";
export type AiCallPoint = "scoring" | "pnd" | "report" | "promo";
export type AiTrigger = "harvest" | "on-demand" | "batch-report" | "promo";

export interface AiCostContext {
  trigger: AiTrigger;
  scanId?: string;
  symbol?: string;
  userId?: string;
}

export interface ChatJSONRequest {
  callPoint: AiCallPoint;
  systemPrompt: string;
  userMessage: string;
  tier: "standard" | "mini";
  temperature: number;
  context?: AiCostContext;
}

export interface ChatJSONResponse {
  content: string;
  provider: AiProvider;
  model?: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
}
