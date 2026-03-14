/**
 * Compute an opportunity score (0-100) that rewards early, pre-consensus signals.
 *
 * Unlike aiScore (which measures signal confidence / documentation quality),
 * opportunityScore is designed to correlate with actual returns: low-consensus,
 * novel, fast-moving, small-cap tickers near 52-week lows score highest.
 */

interface OpportunityScoreInput {
  aiScore: number;
  firstSeenDaysAgo: number | null; // null = truly novel
  priorAppearances: number;
  avgVelocity: number;
  price: number | null | undefined;
  marketCap: number | null | undefined;
  wk52Lo: number | null | undefined;
  wk52Hi: number | null | undefined;
  medianSignalAgeHrs: number | null | undefined;
  shortFloat: number | null | undefined;
  sourceCount: number;
  stage: string;
  totalUpvotes?: number;
  totalComments?: number;
}

export function computeOpportunityScore(input: OpportunityScoreInput): number {
  let score = 0;

  // --- Novelty (0-30) ---
  if (input.firstSeenDaysAgo === null) {
    score += 30; // truly novel
  } else if (input.firstSeenDaysAgo === 0) {
    score += 25; // first seen today
  } else if (input.firstSeenDaysAgo <= 2) {
    score += 15;
  } else {
    score += Math.max(0, 8 - input.priorAppearances);
  }

  // --- Inverted confidence (0-25): low aiScore = more upside ---
  score += Math.max(0, 25 - Math.floor(input.aiScore / 4));

  // --- Velocity (0-15) ---
  if (input.avgVelocity >= 2.5) score += 15;
  else if (input.avgVelocity >= 2.0) score += 12;
  else if (input.avgVelocity >= 1.5) score += 8;
  else if (input.avgVelocity >= 1.0) score += 4;

  // --- Price / market cap (0-15) ---
  if (input.marketCap != null) {
    if (input.marketCap < 50_000_000) score += 15;
    else if (input.marketCap < 300_000_000) score += 12;
    else if (input.marketCap < 2_000_000_000) score += 6;
  }

  // --- Near 52-week low (0-10) ---
  if (input.price != null && input.wk52Lo != null && input.wk52Lo > 0) {
    const pctFromLow = (input.price - input.wk52Lo) / input.wk52Lo;
    if (pctFromLow >= 0.007 && pctFromLow < 0.30) score += 10;
    else if (pctFromLow < 0.50) score += 5;
  }

  // --- Short squeeze potential (0-5) ---
  if (input.shortFloat != null) {
    if (input.shortFloat >= 0.15) score += 5;
    else if (input.shortFloat >= 0.075) score += 3;
  }

  // --- Freshness (0-5) ---
  if (input.medianSignalAgeHrs != null) {
    if (input.medianSignalAgeHrs < 3) score += 5;
    else if (input.medianSignalAgeHrs < 6) score += 3;
  }

  // --- Comment-heavy penalty / conviction bonus (ML: upvote/comment ratio) ---
  const upvotes = input.totalUpvotes ?? 0;
  const comments = input.totalComments ?? 0;
  if (comments > 150 && upvotes / (comments || 1) < 2) {
    score -= 8; // peak hype
  } else if (upvotes > 200 && upvotes / (comments || 1) > 5) {
    score += 3; // conviction
  }

  return Math.max(0, Math.min(100, score));
}
