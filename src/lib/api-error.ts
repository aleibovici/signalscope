import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Shared API error handler for catch blocks.
 * Maps known error types to appropriate HTTP status codes.
 */
export function handleApiError(err: unknown, label: string): NextResponse {
  if (err instanceof Error && err.message === "Not authenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof Error && err.message.startsWith("API key rate limit exceeded")) {
    return NextResponse.json({ error: err.message }, { status: 429 });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
  }
  console.error(`[${label}] error:`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
