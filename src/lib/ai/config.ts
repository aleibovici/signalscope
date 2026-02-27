import type { AiProvider, AiCallPoint } from "./types";

const CALL_POINT_ENV: Record<AiCallPoint, string> = {
  scoring: "AI_PROVIDER_SCORING",
  pnd: "AI_PROVIDER_PND",
  report: "AI_PROVIDER_REPORT",
};

function hasKey(provider: AiProvider): boolean {
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  return false;
}

function otherProvider(p: AiProvider): AiProvider {
  return p === "openai" ? "anthropic" : "openai";
}

export function resolveProviderOrder(
  callPoint: AiCallPoint
): [AiProvider, AiProvider | null] {
  const override = process.env[CALL_POINT_ENV[callPoint]] as
    | AiProvider
    | undefined;
  const globalPrimary =
    (process.env.AI_PRIMARY_PROVIDER as AiProvider | undefined) ?? "openai";

  const primary = override ?? globalPrimary;
  const secondary = otherProvider(primary);

  if (!hasKey(primary) && hasKey(secondary)) {
    return [secondary, null];
  }

  return [primary, hasKey(secondary) ? secondary : null];
}
