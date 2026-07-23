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

const VALID_PROVIDERS: AiProvider[] = ["openai", "anthropic"];

function validateProvider(envVar: string, value: string | undefined): AiProvider | undefined {
  if (!value) return undefined;
  if (VALID_PROVIDERS.includes(value as AiProvider)) return value as AiProvider;
  console.warn(`[ai] Invalid ${envVar}="${value}", ignoring (valid: ${VALID_PROVIDERS.join(", ")})`);
  return undefined;
}

export function resolveProviderOrder(
  callPoint: AiCallPoint
): [AiProvider, AiProvider | null] {
  const override = validateProvider(
    CALL_POINT_ENV[callPoint],
    process.env[CALL_POINT_ENV[callPoint]]
  );
  const globalPrimary =
    validateProvider("AI_PRIMARY_PROVIDER", process.env.AI_PRIMARY_PROVIDER) ?? "openai";

  const primary = override ?? globalPrimary;
  const secondary = otherProvider(primary);

  if (!hasKey(primary) && hasKey(secondary)) {
    return [secondary, null];
  }

  return [primary, hasKey(secondary) ? secondary : null];
}
