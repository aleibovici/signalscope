/**
 * Push an event to the GTM dataLayer.
 * GA4, Reddit Pixel, X Pixel, and LinkedIn conversion tags fire via GTM triggers.
 */
export function trackEvent(
  event: string,
  params?: Record<string, unknown>,
) {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({ event, ...params });
  }
}

/**
 * Track a conversion event and wait briefly for pixel requests to flush
 * before a page navigation. Use this instead of trackEvent() when the
 * next line navigates away (window.location.href, router.push, etc.).
 */
export function trackConversion(
  event: string,
  params?: Record<string, unknown>,
): Promise<void> {
  trackEvent(event, params);
  return new Promise((resolve) => setTimeout(resolve, 300));
}
