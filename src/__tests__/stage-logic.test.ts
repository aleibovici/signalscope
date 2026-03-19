import { describe, it, expect } from "vitest";
import { determineStage } from "@/lib/harvester/index";
import type { NoveltyContext } from "@/lib/harvester/types";

function novel(): NoveltyContext {
  return { firstSeenAt: null, daysSinceFirstSeen: null, priorAppearances: 0, isNovel: true };
}

function recurring(): NoveltyContext {
  return { firstSeenAt: new Date(), daysSinceFirstSeen: 5, priorAppearances: 2, isNovel: false };
}

describe("determineStage — FILTERED", () => {
  it("returns FILTERED when pndFlagged is true regardless of score", () => {
    expect(determineStage(90, 5, 10, 3.0, true, true)).toBe("FILTERED");
  });

  it("returns FILTERED even with high score and many sources", () => {
    expect(determineStage(100, 5, 15, 5.0, true, true)).toBe("FILTERED");
  });
});

describe("determineStage — CONFIRMED via non-social source", () => {
  it("returns CONFIRMED with non-social source, score>=70, sourceCount>=3", () => {
    expect(determineStage(70, 3, 5, 1.0, false, true)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED with non-social source, score>=65, weightedSourceScore>=4", () => {
    expect(determineStage(65, 2, 4, 1.0, false, true)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED with non-social source, score>=65, sourceCount>=2, velocity>=2", () => {
    expect(determineStage(65, 2, 3, 2.0, false, true)).toBe("CONFIRMED");
  });

  it("does not return CONFIRMED without non-social source even with high score and sourceCount", () => {
    const result = determineStage(70, 3, 5, 1.0, false, false);
    expect(result).not.toBe("CONFIRMED");
  });
});

describe("determineStage — CONFIRMED via Reddit subreddit consensus", () => {
  // Note: Reddit CONFIRMED (social-only) requires price >= $0.52 or null (ML: 7d threshold)
  it("returns CONFIRMED when 3+ subreddits, score>=48, velocity>=2.0, fresh signals, price>=0.52", () => {
    // medianSignalAgeHrs=2 (fresh), price=1.50 — should confirm
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined, 1.50)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED when price is null (unknown)", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined, null)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED when medianSignalAgeHrs is null (non-social signals have no age)", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, null, undefined, undefined, undefined, undefined, undefined, 1.00)).toBe("CONFIRMED");
  });

  it("does NOT return CONFIRMED when price < $0.52 (ML: social-only needs price >= $0.52 for 7d follow-through)", () => {
    const result = determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined, 0.40);
    expect(result).not.toBe("CONFIRMED");
  });

  it("returns CONFIRMED at price boundary $0.52", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined, 0.52)).toBe("CONFIRMED");
  });

  it("does NOT return CONFIRMED when signals are stale (medianSignalAgeHrs >= 6)", () => {
    const result = determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 8);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT return CONFIRMED at exactly medianSignalAgeHrs = 6 (boundary)", () => {
    const result = determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 6);
    expect(result).not.toBe("CONFIRMED");
  });

  it("returns CONFIRMED at medianSignalAgeHrs just under 6 with good price", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 5.9, undefined, undefined, undefined, undefined, undefined, 1.00)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED with novel boost pushing score above 48", () => {
    // aiScore=44, novel=true → effectiveScore=49 >= 48
    expect(determineStage(44, 1, 1, 2.0, false, false, novel(), 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined, 1.00)).toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with only 2 subreddits", () => {
    const result = determineStage(48, 1, 1, 2.0, false, false, undefined, 2);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with subredditCount>=3 but score below 48", () => {
    const result = determineStage(47, 1, 1, 2.0, false, false, undefined, 3);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with subredditCount>=3 but velocity below 2.0", () => {
    const result = determineStage(48, 1, 1, 1.9, false, false, undefined, 3);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not apply Reddit CONFIRMED when hasNonSocialSource is true", () => {
    // With non-social source, path checks different conditions
    const result = determineStage(48, 1, 1, 2.0, false, true, undefined, 3);
    // Score 48 with sourceCount=1 doesn't meet any non-social CONFIRMED threshold
    expect(result).not.toBe("CONFIRMED");
  });
});

describe("determineStage — FORMING via score+sourceCount", () => {
  it("returns FORMING with score>=50 and sourceCount>=2", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false)).toBe("FORMING");
  });

  it("does not return FORMING with score=49 and sourceCount>=2", () => {
    const result = determineStage(49, 2, 2, 0.5, false, false);
    expect(result).not.toBe("FORMING");
  });

  it("does not return FORMING with score>=50 but sourceCount=1", () => {
    const result = determineStage(50, 1, 1, 0.5, false, false);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — FORMING via velocity", () => {
  it("returns FORMING with score>=45 and velocity>=2.0", () => {
    expect(determineStage(45, 1, 1, 2.0, false, false)).toBe("FORMING");
  });

  it("does not return FORMING with score=44 and velocity>=2.0 (no pctFrom52wkLow)", () => {
    const result = determineStage(44, 1, 1, 2.0, false, false);
    expect(result).not.toBe("FORMING");
  });

  it("does not return FORMING with score>=45 but velocity=1.9", () => {
    const result = determineStage(45, 1, 1, 1.9, false, false);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — FORMING velocity threshold reduced by pctFrom52wkLow", () => {
  it("returns FORMING with score>=40 when pctFrom52wkLow>=0.007 and velocity>=2.0", () => {
    expect(determineStage(40, 1, 1, 2.0, false, false, undefined, undefined, 0.007)).toBe("FORMING");
  });

  it("returns FORMING with score=43 when pctFrom52wkLow>=0.007 and velocity>=2.0", () => {
    expect(determineStage(43, 1, 1, 2.0, false, false, undefined, undefined, 0.5)).toBe("FORMING");
  });

  it("does not return FORMING with score=39 even with pctFrom52wkLow>=0.007", () => {
    const result = determineStage(39, 1, 1, 2.0, false, false, undefined, undefined, 0.5);
    expect(result).not.toBe("FORMING");
  });

  it("uses normal threshold of 45 when pctFrom52wkLow is below 0.007", () => {
    const result = determineStage(42, 1, 1, 2.0, false, false, undefined, undefined, 0.005);
    expect(result).not.toBe("FORMING");
  });

  it("uses normal threshold of 45 when pctFrom52wkLow is undefined", () => {
    const result = determineStage(42, 1, 1, 2.0, false, false, undefined, undefined, undefined);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — FORMING via novelty + sourceCount", () => {
  it("returns FORMING for novel ticker with score>=40 and sourceCount>=2", () => {
    expect(determineStage(40, 2, 2, 0.5, false, false, novel())).toBe("FORMING");
  });

  it("does not return FORMING for recurring ticker with score=40 and sourceCount>=2", () => {
    const result = determineStage(40, 2, 2, 0.5, false, false, recurring());
    expect(result).not.toBe("FORMING");
  });

  it("does not return FORMING for novel ticker with score=39 and sourceCount>=2", () => {
    const result = determineStage(39, 2, 2, 0.5, false, false, novel());
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — FORMING via subredditCount", () => {
  it("returns FORMING with 3+ subreddits, score>=40, velocity>=1.5", () => {
    expect(determineStage(40, 1, 1, 1.5, false, false, undefined, 3)).toBe("FORMING");
  });

  it("does not return FORMING with 2 subreddits", () => {
    const result = determineStage(40, 1, 1, 1.5, false, false, undefined, 2);
    expect(result).toBe("EARLY");
  });

  it("does not return FORMING with subredditCount>=3 but score=39", () => {
    const result = determineStage(39, 1, 1, 1.5, false, false, undefined, 3);
    expect(result).toBe("EARLY");
  });

  it("does not return FORMING with subredditCount>=3 but velocity=1.4", () => {
    const result = determineStage(40, 1, 1, 1.4, false, false, undefined, 3);
    expect(result).toBe("EARLY");
  });
});

describe("determineStage — CONFIRMED via amex_penny", () => {
  it("returns CONFIRMED when amex penny with sub-dollar wk52Lo recovering above floor", () => {
    // isAmexPenny=true, wk52Lo=0.50, pctFrom52wkLow=0.10, score=48, velocity=2.0
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, true)).toBe("CONFIRMED");
  });

  it("does NOT confirm when wk52Lo >= 1.0", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 1.5, true)).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when isAmexPenny is false", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, false)).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when score < 48", () => {
    expect(determineStage(47, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, true)).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when velocity < 2.0", () => {
    expect(determineStage(48, 1, 1, 1.9, false, false, undefined, undefined, 0.10, 0.50, true)).not.toBe("CONFIRMED");
  });
});

describe("determineStage — FORMING via amex_penny", () => {
  it("returns FORMING for amex penny with pctFrom52wkLow>=0.007, wk52Lo>=0.09, score>=40, velocity>=1.5", () => {
    expect(determineStage(40, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.50, true)).toBe("FORMING");
  });

  it("does NOT form when isAmexPenny is false", () => {
    const result = determineStage(40, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.50, false);
    expect(result).not.toBe("FORMING");
  });

  it("does NOT form when pctFrom52wkLow < 0.007", () => {
    const result = determineStage(40, 1, 1, 1.5, false, false, undefined, undefined, 0.005, 0.50, true);
    expect(result).not.toBe("FORMING");
  });

  it("does NOT form when score < 40", () => {
    const result = determineStage(39, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.50, true);
    expect(result).not.toBe("FORMING");
  });

  it("returns EARLY when wk52Lo is sub-dime (zombie stock)", () => {
    expect(determineStage(40, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.05, true)).toBe("EARLY");
  });
});

describe("determineStage — velocity threshold = 37 for sub-dollar wk52Lo", () => {
  it("returns FORMING with score=37 when pctFrom52wkLow>=0.007 and wk52Lo<1.0", () => {
    expect(determineStage(37, 1, 1, 2.0, false, false, undefined, undefined, 0.007, 0.5)).toBe("FORMING");
  });

  it("does NOT form with score=36 even with sub-dollar wk52Lo", () => {
    const result = determineStage(36, 1, 1, 2.0, false, false, undefined, undefined, 0.007, 0.5);
    expect(result).not.toBe("FORMING");
  });

  it("uses threshold=40 when wk52Lo >= 1.0 (not sub-dollar)", () => {
    // score=37 < 40, so should NOT form
    const result = determineStage(37, 1, 1, 2.0, false, false, undefined, undefined, 0.007, 1.5);
    expect(result).not.toBe("FORMING");
    // score=40 >= 40, so should form
    expect(determineStage(40, 1, 1, 2.0, false, false, undefined, undefined, 0.007, 1.5)).toBe("FORMING");
  });
});

describe("determineStage — EARLY fallback", () => {
  it("returns EARLY when no conditions are met", () => {
    expect(determineStage(30, 1, 1, 0.5, false, false)).toBe("EARLY");
  });

  it("returns EARLY for low score regardless of sourceCount", () => {
    expect(determineStage(20, 5, 10, 0.5, false, false)).toBe("EARLY");
  });
});

describe("determineStage — novelty +5 boost affecting stage boundary", () => {
  it("novel ticker with aiScore=44 gets +5 → effectiveScore=49, reaches FORMING via score+sourceCount", () => {
    // effectiveScore 49 < 50 so doesn't meet score+sourceCount FORMING
    const result = determineStage(44, 2, 2, 0.5, false, false, novel());
    // novel + aiScore>=40 + sourceCount>=2 → FORMING
    expect(result).toBe("FORMING");
  });

  it("novel ticker with aiScore=45 gets effectiveScore=50, reaches FORMING via score+sourceCount", () => {
    expect(determineStage(45, 2, 2, 0.5, false, false, novel())).toBe("FORMING");
  });

  it("novel ticker with aiScore=45 gets effectiveScore=50 → CONFIRMED if non-social path matches", () => {
    // non-social + effectiveScore=50 doesn't meet 65 threshold → FORMING via score+sourceCount
    expect(determineStage(45, 3, 5, 1.0, false, true, novel())).toBe("FORMING");
  });
});

describe("determineStage — price floor", () => {
  it("returns EARLY when price < $0.12 and no catalyst source", () => {
    // score=60 + sourceCount=3 would normally be FORMING, but sub-$0.12 blocks it (ML: 1d threshold $0.12)
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.10)).toBe("EARLY");
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.05)).toBe("EARLY");
  });

  it("returns EARLY when price $0.12-$0.20 for social-only non-penny (ML: 3d threshold $0.20)", () => {
    // Social-only (no catalyst, no exchange penny) at $0.15 — blocked by $0.20 floor
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.15)).toBe("EARLY");
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.19)).toBe("EARLY");
  });

  it("allows FORMING for exchange penny at $0.15 (exempt from $0.20 floor)", () => {
    // AMEX penny at $0.15 — exempted from social-only $0.20 floor
    expect(determineStage(40, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.12, true, false, undefined, undefined, undefined, undefined, undefined, undefined, 0.15)).toBe("FORMING");
  });

  it("allows promotion when price >= $0.20 for social-only", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.25)).toBe("FORMING");
  });

  it("allows promotion when price < $0.12 but has catalyst source", () => {
    // hasNonSocialSource=true bypasses the price floor
    expect(determineStage(70, 3, 5, 1.0, false, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.05)).toBe("CONFIRMED");
  });

  it("allows promotion when price is null (unknown)", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, null)).toBe("FORMING");
  });

  it("allows promotion when price is undefined", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false)).toBe("FORMING");
  });

  it("returns EARLY at price boundary $0.119 (just under $0.12)", () => {
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.119)).toBe("EARLY");
  });

  it("allows promotion at price exactly $0.20 (social-only FORMING boundary)", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0.20)).toBe("FORMING");
  });
});

describe("determineStage — market cap floor", () => {
  it("returns EARLY when marketCap < $12M and no catalyst source", () => {
    // score=60 + sourceCount=3 would normally be FORMING, but sub-$12M blocks it (ML: log_market_cap > 16.3 ≈ $12M)
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 3_000_000)).toBe("EARLY");
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 8_000_000)).toBe("EARLY");
    expect(determineStage(60, 3, 3, 2.0, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 11_000_000)).toBe("EARLY");
  });

  it("allows FORMING when marketCap >= $12M", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 12_000_000)).toBe("FORMING");
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 15_000_000)).toBe("FORMING");
  });

  it("allows promotion when marketCap < $12M but has catalyst source", () => {
    // hasNonSocialSource=true bypasses the market cap floor
    expect(determineStage(70, 3, 5, 1.0, false, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 3_000_000)).toBe("CONFIRMED");
  });

  it("allows promotion when marketCap is null (unknown)", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, null)).toBe("FORMING");
  });

  it("allows promotion when marketCap is undefined", () => {
    expect(determineStage(50, 2, 2, 0.5, false, false)).toBe("FORMING");
  });
});

describe("determineStage — CONFIRMED via short squeeze", () => {
  it("returns CONFIRMED for AMEX penny with high short float near 52wk low", () => {
    // isAmexPenny=true, shortFloat=0.25, pctFrom52wkLow=0.50, score=45, velocity=1.5
    expect(determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, 0.25)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED for NasdaqCM penny with high short float near 52wk low", () => {
    expect(determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, false, true, undefined, 20_000_000, 0.25)).toBe("CONFIRMED");
  });

  it("does NOT confirm when shortFloat < 0.15", () => {
    const result = determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, 0.14);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when pctFrom52wkLow >= 0.98 (already doubled)", () => {
    const result = determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.98, 0.50, true, false, undefined, 20_000_000, 0.25);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when neither AMEX nor NasdaqCM penny", () => {
    const result = determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, false, false, undefined, 20_000_000, 0.25);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when score < 45", () => {
    const result = determineStage(44, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, 0.25);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when velocity < 1.5", () => {
    const result = determineStage(45, 1, 1, 1.4, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, 0.25);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when shortFloat is null", () => {
    const result = determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, null);
    expect(result).not.toBe("CONFIRMED");
  });

  it("confirms with shortFloat=0.15 (lowered threshold)", () => {
    expect(determineStage(45, 1, 1, 1.5, false, false, undefined, undefined, 0.50, 0.50, true, false, undefined, 20_000_000, 0.15)).toBe("CONFIRMED");
  });
});

describe("determineStage — FORMING via short squeeze (moderate SI)", () => {
  it("returns FORMING for AMEX penny with shortFloat>=0.075, score>=45, velocity>=2.0", () => {
    expect(determineStage(45, 1, 1, 2.0, false, false, undefined, undefined, undefined, undefined, true, false, undefined, 20_000_000, 0.08)).toBe("FORMING");
  });

  it("returns FORMING for NasdaqCM penny with shortFloat>=0.075, score>=45, velocity>=2.0", () => {
    expect(determineStage(45, 1, 1, 2.0, false, false, undefined, undefined, undefined, undefined, false, true, undefined, 20_000_000, 0.08)).toBe("FORMING");
  });

  it("does NOT form via short squeeze when shortFloat < 0.075 (may form via other paths)", () => {
    // shortFloat below threshold — but score=45 + velocity=2.0 still hits generic FORMING path
    // Use score=42 to isolate: 42 < 45 generic threshold but >= 45 not met without SI path
    const result = determineStage(42, 1, 1, 2.0, false, false, undefined, undefined, undefined, undefined, true, false, undefined, 20_000_000, 0.07);
    expect(result).not.toBe("FORMING");
  });

  it("does NOT form when score < 45", () => {
    const result = determineStage(44, 1, 1, 2.0, false, false, undefined, undefined, undefined, undefined, true, false, undefined, 20_000_000, 0.08);
    expect(result).not.toBe("FORMING");
  });

  it("does NOT form when velocity < 2.0", () => {
    const result = determineStage(42, 1, 1, 1.9, false, false, undefined, undefined, undefined, undefined, true, false, undefined, 20_000_000, 0.08);
    expect(result).not.toBe("FORMING");
  });

  it("does NOT form via short squeeze when neither AMEX nor NasdaqCM penny (may form via other paths)", () => {
    // Use score=42 to isolate: below generic FORMING threshold of 45
    const result = determineStage(42, 1, 1, 2.0, false, false, undefined, undefined, undefined, undefined, false, false, undefined, 20_000_000, 0.08);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — CONFIRMED via NasdaqCM penny (updated threshold 52)", () => {
  it("returns CONFIRMED at score=52 for NasdaqCM penny", () => {
    expect(determineStage(52, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, false, true)).toBe("CONFIRMED");
  });

  it("does NOT confirm at score=51 for NasdaqCM penny (raised from 50)", () => {
    expect(determineStage(51, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, false, true)).not.toBe("CONFIRMED");
  });

  it("still confirms AMEX penny at score=48 (unchanged)", () => {
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, undefined, 0.10, 0.50, true, false)).toBe("CONFIRMED");
  });
});

describe("determineStage — FORMING via NasdaqCM penny (updated threshold 44)", () => {
  it("returns FORMING at score=44 for NasdaqCM penny", () => {
    expect(determineStage(44, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.50, false, true)).toBe("FORMING");
  });

  it("does NOT form at score=43 for NasdaqCM penny (raised from 42)", () => {
    const result = determineStage(43, 1, 1, 1.5, false, false, undefined, undefined, 0.10, 0.50, false, true);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — comment-heavy demotion", () => {
  it("blocks Reddit CONFIRMED when comment-heavy (>150 comments, ratio < 2:1)", () => {
    // Without comment-heavy: 3 subreddits, score=48, velocity=2.0 → CONFIRMED
    // With comment-heavy: should NOT be CONFIRMED
    const result = determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, 200, 200, 1.50);
    expect(result).not.toBe("CONFIRMED");
  });

  it("allows Reddit CONFIRMED when comments are high but ratio is good", () => {
    // 200 upvotes, 50 comments → ratio 4:1, not comment-heavy
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, 200, 50, 1.50)).toBe("CONFIRMED");
  });

  it("allows Reddit CONFIRMED when comment count is below 150", () => {
    // 100 comments with low ratio — but below 150 threshold
    expect(determineStage(48, 1, 1, 2.0, false, false, undefined, 3, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, 100, 100, 1.50)).toBe("CONFIRMED");
  });
});

describe("determineStage — conviction boost", () => {
  it("boosts FORMING threshold with high upvote/comment ratio (>5:1, >200 upvotes)", () => {
    // score=47 < 50 normally, but conviction +3 → 50, with sourceCount=2 → FORMING
    expect(determineStage(47, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 300, 20)).toBe("FORMING");
  });

  it("does not boost when upvotes <= 200", () => {
    // score=47, upvotes=150 (<=200) → no conviction, stays EARLY
    const result = determineStage(47, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 150, 20);
    expect(result).not.toBe("FORMING");
  });

  it("does not boost when ratio <= 5:1", () => {
    // score=47, 300 upvotes but 100 comments → ratio 3:1, no conviction
    const result = determineStage(47, 2, 2, 0.5, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 300, 100);
    expect(result).not.toBe("FORMING");
  });
});

describe("determineStage — CONFIRMED via recovery play", () => {
  it("returns CONFIRMED for beaten-down stock with high wk52HighRatio", () => {
    // pctFrom52wkLow=0.20, wk52HighRatio=4.0, score=55, sourceCount=2
    expect(determineStage(55, 2, 2, 1.0, false, false, undefined, undefined, 0.20, undefined, undefined, undefined, undefined, undefined, undefined, 4.0)).toBe("CONFIRMED");
  });

  it("does NOT confirm when pctFrom52wkLow >= 0.30", () => {
    const result = determineStage(55, 2, 2, 1.0, false, false, undefined, undefined, 0.30, undefined, undefined, undefined, undefined, undefined, undefined, 4.0);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when wk52HighRatio <= 3.0", () => {
    const result = determineStage(55, 2, 2, 1.0, false, false, undefined, undefined, 0.20, undefined, undefined, undefined, undefined, undefined, undefined, 3.0);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when score < 55", () => {
    const result = determineStage(54, 2, 2, 1.0, false, false, undefined, undefined, 0.20, undefined, undefined, undefined, undefined, undefined, undefined, 4.0);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when sourceCount < 2", () => {
    const result = determineStage(55, 1, 1, 1.0, false, false, undefined, undefined, 0.20, undefined, undefined, undefined, undefined, undefined, undefined, 4.0);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does NOT confirm when wk52HighRatio is null", () => {
    const result = determineStage(55, 2, 2, 1.0, false, false, undefined, undefined, 0.20, undefined, undefined, undefined, undefined, undefined, undefined, null);
    expect(result).not.toBe("CONFIRMED");
  });
});
