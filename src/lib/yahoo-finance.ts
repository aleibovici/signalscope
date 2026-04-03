import YahooFinance from "yahoo-finance2";

/** Default timeout for Yahoo Finance API calls (quote, quoteSummary, historical, options, etc.) */
export const YAHOO_FINANCE_TIMEOUT_MS = 10_000;

export const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export function withYahooTimeout<T>(
  promise: Promise<T>,
  ms: number = YAHOO_FINANCE_TIMEOUT_MS,
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Yahoo Finance timeout after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.then((v) => {
      clearTimeout(timerId);
      return v;
    }),
    timeoutPromise,
  ]);
}
