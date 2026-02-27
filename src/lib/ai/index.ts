import type { ChatJSONRequest, ChatJSONResponse, AiProvider } from "./types";
import { resolveProviderOrder } from "./config";
import { chatJSONOpenAI } from "./openai";
import { chatJSONAnthropic } from "./anthropic";
import { addCost } from "./cost-tracker";

export type { AiProvider, AiCallPoint, ChatJSONRequest, ChatJSONResponse } from "./types";
export { resetCostTracker, getTotalCost } from "./cost-tracker";

const PROVIDERS: Record<
  AiProvider,
  (req: ChatJSONRequest) => Promise<ChatJSONResponse>
> = {
  openai: chatJSONOpenAI,
  anthropic: chatJSONAnthropic,
};

export async function chatJSON(req: ChatJSONRequest): Promise<ChatJSONResponse> {
  const [primary, secondary] = resolveProviderOrder(req.callPoint);

  try {
    const result = await PROVIDERS[primary](req);
    if (result.cost) addCost(result.cost);
    return result;
  } catch (err) {
    console.warn(
      `[ai] ${primary} failed for ${req.callPoint}:`,
      err instanceof Error ? err.message : err
    );

    if (secondary) {
      console.warn(`[ai] Falling back to ${secondary} for ${req.callPoint}`);
      const result = await PROVIDERS[secondary](req);
      if (result.cost) addCost(result.cost);
      return result;
    }

    throw err;
  }
}
