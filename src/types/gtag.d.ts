declare function gtag(...args: unknown[]): void;

interface Window {
  gtag?: typeof gtag;
  dataLayer?: unknown[];
}
