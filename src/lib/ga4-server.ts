const GA4_MEASUREMENT_ID = "G-TFSF1MJ97V";

/**
 * Send a server-side event to GA4 via the Measurement Protocol.
 * Fire-and-forget — never blocks the caller.
 */
export function sendGA4Event(
  clientId: string,
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  const apiSecret = process.env.GA4_API_SECRET;
  if (!apiSecret) return;

  fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${apiSecret}`,
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
