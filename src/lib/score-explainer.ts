/**
 * Shared copy: Opportunity Score (early-mover) vs AI / Signal Confidence (evidence strength).
 * Used across dashboard, trending, performance, methodology, and API responses.
 */

export const scoreExplainerDashboardCallout =
  "Reading the cards: Signals are ordered by Opportunity (early-mover potential). Confidence is how strong the evidence is — when it is very high, the move may already be priced in, which is why it does not always line up with forward returns.";

/** Trending default sort is appearances, not opportunity — clarify sort vs on-card scores */
export const scoreExplainerTrendingCallout =
  "Each card lists Opportunity (early-mover potential) and Confidence (how strong the evidence is). Default sort is appearances; pick Opportunity Score under Sort to order by that value. High Confidence can mean the crowd already agrees — not necessarily more remaining upside.";

/** Full-width insight on Performance (bucket tables) */
export const scoreExplainerPerformanceInsight =
  "Two different questions: Confidence measures how strong the case is (it can rise as more people pile on). Opportunity measures how early or favorable the setup is for catching a move. In backtests, average returns are not highest in the top Confidence bucket — strong evidence can mean the trade is crowded. Opportunity tiers line up more intuitively with early alpha; use Median alongside Average to see skew from outliers.";

export const scoreExplainerMethodologyTitle =
  "Opportunity Score vs signal confidence (AI)";

export const scoreExplainerMethodologyBody =
  "SignalScope shows two independent 0–100 metrics. Opportunity (early-mover score) ranks how favorable the setup is for timing — validated in ML and used to sort the Signal Dashboard. Signal confidence (AI score) measures how strong the evidence is across sources and sentiment. A very high AI score often coincides with broad agreement; by then, more of the move may already be in the price, so higher confidence does not always mean higher forward returns. Use Opportunity when you care about being early; use confidence when you care about how well-supported the thesis is.";

/** Connections graph — short note above the visualization */
export const scoreExplainerConnectionsCallout =
  "Node size reflects AI confidence (evidence strength). For early-mover rank, open the ticker — Opportunity is shown on each card and detail page. High confidence does not always mean more upside left.";
