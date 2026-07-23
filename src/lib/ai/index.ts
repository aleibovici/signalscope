import type { ChatJSONRequest, ChatJSONResponse, AiProvider } from "./types";
import { resolveProviderOrder } from "./config";
import { chatJSONOpenAI } from "./openai";
import { chatJSONAnthropic } from "./anthropic";
import { addCost } from "./cost-tracker";
import { prisma } from "@/lib/prisma";

export type { AiProvider, AiCallPoint, AiCostContext, AiTrigger, ChatJSONRequest, ChatJSONResponse } from "./types";
export { resetCostTracker, getTotalCost } from "./cost-tracker";

const PROVIDERS: Record<
  AiProvider,
  (req: ChatJSONRequest) => Promise<ChatJSONResponse>
> = {
  openai: chatJSONOpenAI,
  anthropic: chatJSONAnthropic,
};

function logCost(req: ChatJSONRequest, result: ChatJSONResponse): void {
  if (!req.context || result.inputTokens == null) return;
  prisma.aiCostLog
    .create({
      data: {
        callPoint: req.callPoint,
        trigger: req.context.trigger,
        provider: result.provider,
        model: result.model ?? "unknown",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens ?? 0,
        cost: result.cost ?? 0,
        scanId: req.context.scanId ?? null,
        symbol: req.context.symbol ?? null,
        userId: req.context.userId ?? null,
      },
    })
    .catch((err) => console.error("[ai] Failed to log cost:", err));
}

export async function chatJSON(req: ChatJSONRequest): Promise<ChatJSONResponse> {
  const [primary, secondary] = resolveProviderOrder(req.callPoint);

  try {
    const result = await PROVIDERS[primary](req);
    if (result.cost) addCost(result.cost);
    logCost(req, result);
    return result;
  } catch (err) {
    console.warn(
      `[ai] ${primary} failed for ${req.callPoint}:`,
      err instanceof Error ? err.message : err
    );

    if (secondary) {
      console.warn(`[ai] Falling back to ${secondary} for ${req.callPoint}`);
      try {
        const result = await PROVIDERS[secondary](req);
        if (result.cost) addCost(result.cost);
        logCost(req, result);
        return result;
      } catch (fallbackErr) {
        console.error(
          `[ai] ${secondary} fallback also failed for ${req.callPoint}:`,
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
        );
        throw err; // throw original primary error, not the fallback error
      }
    }

    throw err;
  }
}
