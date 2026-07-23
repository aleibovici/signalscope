/**
 * Send a server-side event to GA4 via the Measurement Protocol.
 * Fire-and-forget — never blocks the caller.
 * No-ops unless both NEXT_PUBLIC_GA4_MEASUREMENT_ID and GA4_API_SECRET are set.
 */
export function sendGA4Event(
  clientId: string,
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: eventName, params }],
      }),
    }
  ).catch(() => {
    console.warn(`GA4 Measurement Protocol error for ${eventName}`);
  });
}
