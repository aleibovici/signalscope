export type AiProvider = "openai" | "anthropic";
export type AiCallPoint = "scoring" | "pnd" | "report";

export interface ChatJSONRequest {
  callPoint: AiCallPoint;
  systemPrompt: string;
  userMessage: string;
  tier: "standard" | "mini";
  temperature: number;
}

export interface ChatJSONResponse {
  content: string;
  provider: AiProvider;
  cost?: number; // estimated USD cost for this call
}
