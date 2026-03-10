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
  it("returns CONFIRMED when 3+ subreddits, score>=48, velocity>=2.5, no non-social source", () => {
    expect(determineStage(48, 1, 1, 2.5, false, false, undefined, 3)).toBe("CONFIRMED");
  });

  it("returns CONFIRMED with novel boost pushing score above 48", () => {
    // aiScore=44, novel=true → effectiveScore=49 >= 48
    expect(determineStage(44, 1, 1, 2.5, false, false, novel(), 3)).toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with only 2 subreddits", () => {
    const result = determineStage(48, 1, 1, 2.5, false, false, undefined, 2);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with subredditCount>=3 but score below 48", () => {
    const result = determineStage(47, 1, 1, 2.5, false, false, undefined, 3);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not return CONFIRMED with subredditCount>=3 but velocity below 2.5", () => {
    const result = determineStage(48, 1, 1, 2.4, false, false, undefined, 3);
    expect(result).not.toBe("CONFIRMED");
  });

  it("does not apply Reddit CONFIRMED when hasNonSocialSource is true", () => {
    // With non-social source, path checks different conditions
    const result = determineStage(48, 1, 1, 2.5, false, true, undefined, 3);
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
