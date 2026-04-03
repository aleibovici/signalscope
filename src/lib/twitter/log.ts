import { prisma } from "@/lib/prisma";

/**
 * Log an X API call for usage tracking on the admin dashboard.
 * Fire-and-forget — never throws.
 */
export function logXApiCall(params: {
  endpoint: string;
  method: string;
  action: string;
  count?: number;
  statusCode?: number;
}): void {
  prisma.xApiLog
    .create({
      data: {
        endpoint: params.endpoint,
        method: params.method,
        action: params.action,
        count: params.count ?? 1,
        statusCode: params.statusCode ?? undefined,
      },
    })
    .catch((err) => {
      console.warn("[x-api-log] Failed to log:", err);
    });
}
