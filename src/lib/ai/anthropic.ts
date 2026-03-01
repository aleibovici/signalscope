import Anthropic from "@anthropic-ai/sdk";
import type { ChatJSONRequest, ChatJSONResponse } from "./types";

const MODEL_MAP = {
  standard: "claude-sonnet-4-20250514",
  mini: "claude-haiku-4-5-20251001",
} as const;

// Pricing per 1M tokens (USD) — update if Anthropic changes pricing
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80, output: 4.00 },
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export async function chatJSONAnthropic(
  req: ChatJSONRequest
): Promise<ChatJSONResponse> {
  const model = MODEL_MAP[req.tier];
  const response = await getClient().messages.create({
    model,
    max_tokens: 4096,
    temperature: req.temperature,
    system: `${req.systemPrompt}\n\nYou must respond with valid JSON only. No other text.`,
    messages: [
      { role: "user", content: req.userMessage },
      { role: "assistant", content: "{" },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }

  const raw = textBlock.text.trim().startsWith("{") ? textBlock.text.trim() : "{" + textBlock.text;
  JSON.parse(raw); // validate — throws if invalid

  const cost = computeCost(model, response.usage.input_tokens, response.usage.output_tokens);

  return { content: raw, provider: "anthropic", cost };
}
