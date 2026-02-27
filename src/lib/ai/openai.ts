import OpenAI from "openai";
import type { ChatJSONRequest, ChatJSONResponse } from "./types";

const MODEL_MAP = { standard: "gpt-4o", mini: "gpt-4o-mini" } as const;

// Pricing per 1M tokens (USD) — update if OpenAI changes pricing
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":      { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export async function chatJSONOpenAI(
  req: ChatJSONRequest
): Promise<ChatJSONResponse> {
  const model = MODEL_MAP[req.tier];
  const response = await getClient().chat.completions.create({
    model,
    temperature: req.temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  const usage = response.usage;
  const cost = usage
    ? computeCost(model, usage.prompt_tokens, usage.completion_tokens)
    : 0;

  return { content, provider: "openai", cost };
}
