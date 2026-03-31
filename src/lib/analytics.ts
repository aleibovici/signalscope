/**
 * Push an event to the GTM dataLayer.
 * GA4 and Reddit Pixel conversion tags fire via GTM triggers.
 */
export function trackEvent(
  event: string,
  params?: Record<string, unknown>,
) {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({ event, ...params });
  }
}
